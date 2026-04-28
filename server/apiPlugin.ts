import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import { generateComicFromPayload } from "./comicService";
import { logError, logInfo } from "./logger";
import { buildHealthJson, buildPrometheusMetrics, recordHttpMetric } from "./metrics";
import { isHttpError } from "./errors";
import { checkRateLimit, getRateLimitConfig } from "./rateLimiter";

const COMIC_ENDPOINT = "/api/comic-generate";
const METRICS_ENDPOINT = "/api/metrics";
const HEALTH_ENDPOINT = "/api/health";

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
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error("El payload excede el máximo permitido."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.socket.remoteAddress || "unknown";
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

    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};

    await logInfo("comic.generate.started", context.requestId, {
      hasPhoto: Boolean((payload as Record<string, unknown>)?.photo),
      userNameLength: typeof (payload as Record<string, unknown>)?.userName === "string"
        ? ((payload as Record<string, unknown>).userName as string).length
        : 0,
    });

    const result = await generateComicFromPayload(payload);
    const durationMs = Date.now() - context.startMs;

    await logInfo("comic.generate.succeeded", context.requestId, { panels: 6 }, durationMs);
    sendJson(res, 200, result);
  } catch (error) {
    const durationMs = Date.now() - context.startMs;
    if (isHttpError(error)) {
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

    await logError("comic.generate.failed", context.requestId, error, { errorCode: "internal_error", statusCode: 500 }, durationMs);
    sendJson(res, 500, {
      message: "No se pudo generar el cómic en servidor.",
      requestId: context.requestId,
      code: "internal_error",
    });
  }
}

function handleMetrics(req: IncomingMessage, res: ServerResponse): void {
  const startMs = Date.now();
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
