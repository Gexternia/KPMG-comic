import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@google/genai", () => ({
  Modality: { TEXT: "TEXT", IMAGE: "IMAGE" },
  GoogleGenAI: class {
    models = {
      generateContent: async () => {
        throw new Error("Esta prueba no debe llegar a Gemini");
      },
    };
  },
}));

let server: Server;
let baseUrl: string;

async function startApi(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("GEMINI_API_KEY_1", "key-1");
  vi.stubEnv("LOG_LEVEL", "error");
  vi.stubEnv("LOG_TO_CONSOLE", "false");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);

  const { backendApiPlugin } = await import("./apiPlugin");
  let handler: (req: any, res: any, next: () => void) => void = () => undefined;
  backendApiPlugin().configureServer({
    middlewares: { use: (fn: typeof handler) => (handler = fn) },
  } as never);

  server = createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 404;
      res.end("next");
    })
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const postComic = (body: string, contentType = "application/json") =>
  fetch(`${baseUrl}/api/comic-generate`, { method: "POST", headers: { "Content-Type": contentType }, body });

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("POST /api/comic-generate", () => {
  it("responde 400 con JSON inválido", async () => {
    await startApi();
    const response = await postComic("{no-es-json");
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_json");
  });

  it("responde 413 con un cuerpo demasiado grande", async () => {
    await startApi();
    const response = await postComic("x".repeat(11 * 1024 * 1024));
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("payload_too_large");
  });

  it("responde 415 si no es JSON", async () => {
    await startApi();
    const response = await postComic("hola", "text/plain");
    expect(response.status).toBe(415);
  });

  it("devuelve el motivo y el identificador cuando faltan datos", async () => {
    await startApi();
    const response = await postComic("{}");
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe("missing_required_fields");
    expect(body.requestId).toBeTruthy();
  });

  it("deja pasar a un grupo con la misma IP y frena el exceso", async () => {
    await startApi({ RATE_LIMIT_MAX_REQUESTS: "12" });
    const statuses: number[] = [];
    for (let i = 0; i < 13; i += 1) statuses.push((await postComic("{}")).status);
    expect(statuses.slice(0, 12).every((status) => status === 400)).toBe(true);
    expect(statuses[12]).toBe(429);
  });

  it("por defecto admite 30 solicitudes por minuto", async () => {
    await startApi();
    const response = await postComic("{}");
    expect(response.headers.get("x-ratelimit-limit")).toBe("30");
  });
});

describe("endpoints auxiliares", () => {
  it("el endpoint de PDF ya no existe", async () => {
    await startApi();
    const response = await fetch(`${baseUrl}/api/print-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "<h1>x</h1>" }),
    });
    expect(await response.text()).toBe("next");
    expect(response.status).toBe(404);
  });

  it("las métricas no se exponen sin token configurado", async () => {
    await startApi();
    expect((await fetch(`${baseUrl}/api/metrics`)).status).toBe(404);
  });

  it("las métricas exigen el token correcto", async () => {
    await startApi({ METRICS_TOKEN: "secreto" });
    expect((await fetch(`${baseUrl}/api/metrics`)).status).toBe(404);
    const wrong = await fetch(`${baseUrl}/api/metrics`, { headers: { Authorization: "Bearer otro" } });
    expect(wrong.status).toBe(404);

    const ok = await fetch(`${baseUrl}/api/metrics`, { headers: { Authorization: "Bearer secreto" } });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain("app_panel_cache_hits_total");
  });

  it("el estado de salud solo expone lo necesario", async () => {
    await startApi();
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(Object.keys(await response.json()).sort()).toEqual(["status", "timestamp"]);
  });
});
