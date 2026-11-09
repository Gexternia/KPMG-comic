import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import { generateComicFromPayload } from "./comicService";
import { logError, logInfo } from "./logger";
import {
  buildAdminStats,
  buildHealthJson,
  buildPrometheusMetrics,
  recordComicOutcome,
  recordComicStarted,
  recordHttpMetric,
} from "./metrics";
import { HttpError, isHttpError } from "./errors";
import { checkRateLimit, getClientIp, getRateLimitConfig } from "./rateLimiter";
import { createAdminSession, isAdminTokenValid, verifyAdminCredentials } from "./adminAuth";

const COMIC_ENDPOINT = "/api/comic-generate";
const METRICS_ENDPOINT = "/api/metrics";
const HEALTH_ENDPOINT = "/api/health";
const ADMIN_LOGIN_ENDPOINT = "/api/admin/login";
const ADMIN_STATS_ENDPOINT = "/api/admin/stats";
const MAX_BODY_BYTES = 10 * 1024 * 1024;

interface RequestContext {
  requestId: string;
  startMs: number;
}

type ApiMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  context: RequestContext
) => Promise<boolean> | boolean;

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, statusCode: number, body: string, contentType: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", contentType);
  res.end(body);
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Se sigue drenando sin guardar para poder responder 413 sin cortar la conexión.
        req.off("data", onData);
        req.resume();
        reject(new HttpError(413, "El payload excede el máximo permitido.", "payload_too_large"));
        return;
      }
      chunks.push(chunk);
    };
    req.on("data", onData);
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseJsonBody(rawBody: string): unknown {
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new HttpError(400, "El cuerpo de la solicitud no es JSON válido.", "invalid_json");
  }
}

function isMetricsAuthorized(req: IncomingMessage): boolean {
  const token = process.env.METRICS_TOKEN;
  if (!token) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(req.headers.authorization || ""), digest(`Bearer ${token}`));
}

const requestIdMiddleware: ApiMiddleware = (req, res, context) => {
  const ip = getClientIp(req);
  const path = req.url || COMIC_ENDPOINT;
  const method = req.method || "POST";

  res.setHeader("X-Request-Id", context.requestId);
  res.on("finish", () => {
    const durationMs = Date.now() - context.startMs;
    recordHttpMetric(method, path, res.statusCode, durationMs);
    void logInfo("comic.request.completed", context.requestId, {
      method,
      path,
      ip,
      statusCode: res.statusCode,
    }, durationMs);
  });

  void logInfo("comic.request.received", context.requestId, {
    method,
    path,
    ip,
  });
  return true;
};

const jsonContentTypeMiddleware: ApiMiddleware = (req, res, context) => {
  const contentType = req.headers["content-type"] || "";
  if (!String(contentType).includes("application/json")) {
    sendJson(res, 415, {
      message: "Content-Type inválido. Usa application/json.",
      requestId: context.requestId,
    });
    return false;
  }
  return true;
};

const rateLimitMiddleware: ApiMiddleware = (req, res, context) => {
  const ip = getClientIp(req);
  const routeKey = req.url || COMIC_ENDPOINT;
  const decision = checkRateLimit(req, routeKey);
  const config = getRateLimitConfig();

  res.setHeader("X-RateLimit-Limit", String(decision.limit));
  res.setHeader("X-RateLimit-Remaining", String(decision.remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.floor(decision.resetAtMs / 1000)));

  if (!decision.allowed) {
    res.setHeader("Retry-After", String(decision.retryAfterSec));
    sendJson(res, 429, {
      message: "Demasiadas solicitudes. Intenta de nuevo en unos segundos.",
      requestId: context.requestId,
      code: "rate_limited",
    });
    void logInfo("comic.request.rate_limited", context.requestId, {
      ip,
      route: routeKey,
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      retryAfterSec: decision.retryAfterSec,
    });
    return false;
  }
  return true;
};

const middlewares: ApiMiddleware[] = [
  requestIdMiddleware,
  jsonContentTypeMiddleware,
  rateLimitMiddleware,
];

async function handleComicGenerate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const context: RequestContext = {
    requestId: randomUUID(),
    startMs: Date.now(),
  };

  try {
    for (const middleware of middlewares) {
      const shouldContinue = await middleware(req, res, context);
      if (!shouldContinue) return;
    }

    recordComicStarted();
    const rawBody = await readRequestBody(req);
    const payload = parseJsonBody(rawBody);

    await logInfo("comic.generate.started", context.requestId, {
      hasPhoto: Boolean((payload as Record<string, unknown>)?.photo),
      userNameLength: typeof (payload as Record<string, unknown>)?.userName === "string"
        ? ((payload as Record<string, unknown>).userName as string).length
        : 0,
    });

    const clientGone = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) clientGone.abort();
    });

    const result = await generateComicFromPayload(payload, {
      requestId: context.requestId,
      clientSignal: clientGone.signal,
    });
    const durationMs = Date.now() - context.startMs;

    recordComicOutcome("success", durationMs, context.requestId);
    await logInfo("comic.generate.succeeded", context.requestId, { panels: 6 }, durationMs);
    sendJson(res, 200, result);
  } catch (error) {
    const durationMs = Date.now() - context.startMs;
    if (isHttpError(error)) {
      recordComicOutcome("failure", durationMs, context.requestId, error.code);
      await logError(
        "comic.generate.failed",
        context.requestId,
        error,
        { errorCode: error.code, statusCode: error.statusCode },
        durationMs
      );
      sendJson(res, error.statusCode, {
        message: error.message,
        requestId: context.requestId,
        code: error.code,
      });
      return;
    }

    recordComicOutcome("failure", durationMs, context.requestId, "internal_error");
    await logError("comic.generate.failed", context.requestId, error, { errorCode: "internal_error", statusCode: 500 }, durationMs);
    sendJson(res, 500, {
      message: "No se pudo generar el cómic en servidor.",
      requestId: context.requestId,
      code: "internal_error",
    });
  }
}

async function handleAdminLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestId = randomUUID();
  const startMs = Date.now();
  try {
    const rawBody = await readRequestBody(req);
    const payload = parseJsonBody(rawBody) as { email?: unknown; password?: unknown };

    if (!verifyAdminCredentials(payload?.email, payload?.password)) {
      void logInfo("admin.login.failed", requestId, { ip: getClientIp(req) });
      sendJson(res, 401, { message: "Correo o contraseña incorrectos.", code: "invalid_credentials" });
      recordHttpMetric("POST", ADMIN_LOGIN_ENDPOINT, 401, Date.now() - startMs);
      return;
    }

    const session = createAdminSession();
    void logInfo("admin.login.ok", requestId, { ip: getClientIp(req) });
    sendJson(res, 200, session);
    recordHttpMetric("POST", ADMIN_LOGIN_ENDPOINT, 200, Date.now() - startMs);
  } catch (error) {
    const statusCode = isHttpError(error) ? error.statusCode : 500;
    const message = isHttpError(error) ? error.message : "No se pudo procesar el inicio de sesión.";
    sendJson(res, statusCode, { message, code: isHttpError(error) ? error.code : "internal_error" });
    recordHttpMetric("POST", ADMIN_LOGIN_ENDPOINT, statusCode, Date.now() - startMs);
  }
}

function handleAdminStats(req: IncomingMessage, res: ServerResponse): void {
  const startMs = Date.now();
  if (!isAdminTokenValid(req.headers.authorization)) {
    sendJson(res, 401, { message: "No autorizado.", code: "unauthorized" });
    recordHttpMetric("GET", ADMIN_STATS_ENDPOINT, 401, Date.now() - startMs);
    return;
  }
  sendJson(res, 200, buildAdminStats());
  recordHttpMetric("GET", ADMIN_STATS_ENDPOINT, 200, Date.now() - startMs);
}

function handleMetrics(req: IncomingMessage, res: ServerResponse): void {
  const startMs = Date.now();
  if (!isMetricsAuthorized(req)) {
    sendJson(res, 404, { message: "No encontrado." });
    return;
  }
  const body = buildPrometheusMetrics();
  sendText(res, 200, body, "text/plain; version=0.0.4; charset=utf-8");
  recordHttpMetric(req.method || "GET", req.url || METRICS_ENDPOINT, 200, Date.now() - startMs);
}

function handleHealth(req: IncomingMessage, res: ServerResponse): void {
  const startMs = Date.now();
  sendJson(res, 200, buildHealthJson());
  recordHttpMetric(req.method || "GET", req.url || HEALTH_ENDPOINT, 200, Date.now() - startMs);
}

const handler: Connect.NextHandleFunction = (req, res, next) => {
  if (req.method === "GET" && req.url === METRICS_ENDPOINT) {
    handleMetrics(req, res);
    return;
  }

  if (req.method === "GET" && req.url === HEALTH_ENDPOINT) {
    handleHealth(req, res);
    return;
  }

  if (req.method === "POST" && req.url === COMIC_ENDPOINT) {
    void handleComicGenerate(req, res);
    return;
  }

  if (req.method === "POST" && req.url === ADMIN_LOGIN_ENDPOINT) {
    void handleAdminLogin(req, res);
    return;
  }

  if (req.method === "GET" && req.url === ADMIN_STATS_ENDPOINT) {
    handleAdminStats(req, res);
    return;
  }

  next();
};

export const backendApiPlugin = () => ({
  name: "backend-api-plugin",
  configureServer(server: { middlewares: { use: (fn: Connect.NextHandleFunction) => void } }) {
    server.middlewares.use(handler);
  },
  configurePreviewServer(server: { middlewares: { use: (fn: Connect.NextHandleFunction) => void } }) {
    server.middlewares.use(handler);
  },
});
