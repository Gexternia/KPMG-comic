import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeRequest = {
  apiKey: string;
  model: string;
  contents: any;
  config: any;
};
type FakeHandler = (request: FakeRequest) => Promise<unknown>;

const fake = vi.hoisted(() => ({
  imageHandler: null as FakeHandler | null,
  textHandler: null as FakeHandler | null,
  calls: [] as FakeRequest[],
}));

vi.mock("@google/genai", () => ({
  Modality: { TEXT: "TEXT", IMAGE: "IMAGE" },
  GoogleGenAI: class {
    apiKey: string;
    models: { generateContent: (request: Omit<FakeRequest, "apiKey">) => Promise<unknown> };

    constructor({ apiKey }: { apiKey: string }) {
      this.apiKey = apiKey;
      this.models = {
        generateContent: (request) => {
          const full = { ...request, apiKey: this.apiKey };
          fake.calls.push(full);
          const isImage = request.config?.responseModalities !== undefined;
          return (isImage ? fake.imageHandler! : fake.textHandler!)(full);
        },
      };
    }
  },
}));

const PHOTO = "data:image/jpeg;base64,QUJDRA==";
const payload = { userName: "Ana", worstMoment: "Aprendí", bestMoment: "Recuerdo", photo: PHOTO };

const imageResponse = (data = "SU1H") => ({
  candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data } }] } }],
});
const textResponse = () => ({ text: JSON.stringify({ p1: "a", p2: "b", p3: "c", p4: "d" }) });
const apiError = (status: number, message = "error") => Object.assign(new Error(message), { status });

const promptOf = (call: FakeRequest): string => call.contents[0].parts[1].text;
const imageCalls = () => fake.calls.filter((call) => call.config?.responseModalities !== undefined);

async function loadService(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("GEMINI_API_KEY_1", "key-1");
  vi.stubEnv("GEMINI_API_KEY_2", "key-2");
  vi.stubEnv("AI_RETRY_BACKOFF_MS", "1");
  vi.stubEnv("LOG_LEVEL", "error");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import("./comicService");
}

async function rejection(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Se esperaba un error");
}

beforeEach(() => {
  vi.unstubAllEnvs();
  fake.calls.length = 0;
  fake.imageHandler = async () => imageResponse();
  fake.textHandler = async () => textResponse();
});

describe("generación correcta", () => {
  it("pide imágenes verticales 3:4, solo imagen y con el tipo real de la foto", async () => {
    const { generateComicFromPayload } = await loadService();
    const comic = await generateComicFromPayload({ ...payload, photo: "data:image/png;base64,QUJDRA==" });

    expect(comic.cover).toBe("data:image/png;base64,SU1H");
    expect(comic.captions).toEqual({ p1: "a", p2: "b", p3: "c", p4: "d" });
    expect(imageCalls()).toHaveLength(6);
    for (const call of imageCalls()) {
      expect(call.config.imageConfig).toEqual({ aspectRatio: "3:4" });
      expect(call.config.responseModalities).toEqual(["IMAGE"]);
      expect(call.contents[0].parts[0].inlineData).toEqual({ mimeType: "image/png", data: "QUJDRA==" });
    }
  });

  it("reparte las imágenes a partes iguales entre las dos claves", async () => {
    const { generateComicFromPayload } = await loadService();
    await generateComicFromPayload(payload);

    const byKey = imageCalls().map((call) => call.apiKey);
    expect(byKey.filter((key) => key === "key-1")).toHaveLength(3);
    expect(byKey.filter((key) => key === "key-2")).toHaveLength(3);
  });

  it("permite elegir el modelo por variable de entorno", async () => {
    const { generateComicFromPayload } = await loadService({ GEMINI_IMAGE_MODEL: "otro-modelo" });
    await generateComicFromPayload(payload);
    expect(imageCalls().every((call) => call.model === "otro-modelo")).toBe(true);
  });
});

describe("gasto", () => {
  it("si falla una viñeta, al reintentar solo se paga la que falta", async () => {
    const { generateComicFromPayload } = await loadService();
    let failedPrompt: string | null = null;
    fake.imageHandler = async (call) => {
      failedPrompt ??= promptOf(call);
      if (promptOf(call) === failedPrompt) throw apiError(503);
      return imageResponse();
    };

    const error = await rejection(generateComicFromPayload(payload));
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("provider_unavailable");
    expect(error.message).toContain("5 de 6");
    // 5 correctas más los 3 intentos de la que falla
    expect(imageCalls()).toHaveLength(8);

    fake.calls.length = 0;
    fake.imageHandler = async () => imageResponse();
    const comic = await generateComicFromPayload(payload);

    expect(imageCalls()).toHaveLength(1);
    expect(promptOf(imageCalls()[0])).toBe(failedPrompt);
    expect(comic.backCover).toBeTruthy();
  });

  it("repetir un cómic ya generado no vuelve a pagar imágenes", async () => {
    const { generateComicFromPayload } = await loadService();
    await generateComicFromPayload(payload);
    fake.calls.length = 0;
    await generateComicFromPayload(payload);
    expect(imageCalls()).toHaveLength(0);
  });

  it("dos solicitudes iguales simultáneas comparten las mismas llamadas", async () => {
    const { generateComicFromPayload } = await loadService();
    await Promise.all([generateComicFromPayload(payload), generateComicFromPayload(payload)]);
    expect(imageCalls()).toHaveLength(6);
  });

  it("no repite una petición rechazada por contenido", async () => {
    const { generateComicFromPayload } = await loadService();
    fake.imageHandler = async () => ({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } });

    const error = await rejection(generateComicFromPayload(payload));
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("provider_prompt_blocked");
    expect(imageCalls()).toHaveLength(6);
  });

  it("no repite una petición inválida ni un modelo inexistente", async () => {
    const { generateComicFromPayload } = await loadService();
    fake.imageHandler = async () => {
      throw apiError(404, "model not found");
    };

    const error = await rejection(generateComicFromPayload(payload));
    expect(error.code).toBe("provider_model_unavailable");
    expect(imageCalls()).toHaveLength(6);
  });

  it("repite un timeout una sola vez y cancela la petición colgada", async () => {
    const { generateComicFromPayload } = await loadService({ AI_REQUEST_TIMEOUT_MS: "5000", COMIC_DEADLINE_MS: "60000" });
    const signals: AbortSignal[] = [];
    let firstPrompt: string | null = null;
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 500 });
    try {
      fake.imageHandler = (call) => {
        firstPrompt ??= promptOf(call);
        if (promptOf(call) !== firstPrompt) return Promise.resolve(imageResponse());
        signals.push(call.config.abortSignal);
        return new Promise(() => undefined);
      };

      const pending = rejection(generateComicFromPayload(payload));
      const error = await pending;
      expect(error.code).toBe("provider_timeout");
    } finally {
      vi.useRealTimers();
    }
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  }, 30_000);

  it("corta al alcanzar el tope de llamadas por hora", async () => {
    const { generateComicFromPayload } = await loadService({ MAX_IMAGE_CALLS_PER_HOUR: "6" });
    await generateComicFromPayload(payload);
    fake.calls.length = 0;

    const error = await rejection(generateComicFromPayload({ ...payload, userName: "Ana", worstMoment: "Otro texto" }));
    expect(error.code).toBe("generation_budget_exceeded");
    expect(imageCalls()).toHaveLength(0);
  });

  it("textos fallidos no tiran las imágenes y prueban la otra clave", async () => {
    const { generateComicFromPayload } = await loadService();
    fake.textHandler = async () => {
      throw apiError(503);
    };

    const comic = await generateComicFromPayload(payload);
    expect(comic.captions.p1).toBe("Así empezó mi historia en KPMG.");
    const textKeys = fake.calls.filter((call) => call.config?.responseModalities === undefined).map((call) => call.apiKey);
    expect(textKeys).toEqual(["key-1", "key-2"]);
  });
});

describe("claves", () => {
  it("una clave limitada se cambia por la otra y deja de usarse un tiempo", async () => {
    const { generateComicFromPayload } = await loadService();
    fake.imageHandler = async (call) => {
      if (call.apiKey === "key-1") throw apiError(429, "Please retry in 40s");
      return imageResponse();
    };

    await generateComicFromPayload(payload);
    fake.calls.length = 0;
    await generateComicFromPayload({ ...payload, worstMoment: "Otro texto", bestMoment: "Otro recuerdo" });

    const keys = imageCalls().map((call) => call.apiKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => key === "key-2")).toBe(true);
  });

  it("con todas las claves sin cuota falla rápido e indica el motivo", async () => {
    const { generateComicFromPayload } = await loadService();
    fake.imageHandler = async () => {
      throw apiError(429, "Quota exceeded for metric PerDay. Check your plan and billing details.");
    };

    const error = await rejection(generateComicFromPayload(payload));
    expect(error.code).toBe("provider_quota_exhausted");
    expect(imageCalls().length).toBeLessThanOrEqual(12);

    fake.calls.length = 0;
    const second = await rejection(generateComicFromPayload({ ...payload, worstMoment: "Otro texto" }));
    expect(second.code).toBe("provider_quota_exhausted");
    expect(imageCalls()).toHaveLength(0);
  });

  it("funciona con una sola clave", async () => {
    const { generateComicFromPayload } = await loadService({ GEMINI_API_KEY_2: "" });
    await generateComicFromPayload(payload);
    expect(imageCalls().every((call) => call.apiKey === "key-1")).toBe(true);
  });
});

describe("cola", () => {
  const distinct = (id: number) => ({
    ...payload,
    userName: `Persona ${id}`,
    worstMoment: `Texto ${id}`,
    bestMoment: `Recuerdo ${id}`,
    photo: `data:image/jpeg;base64,${btoa(`foto-${id}`)}`,
  });

  function holdImages() {
    const releases: Array<() => void> = [];
    fake.imageHandler = () =>
      new Promise((resolve) => {
        releases.push(() => resolve(imageResponse()));
      });
    return () => {
      while (releases.length) releases.shift()!();
    };
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

  it("quien supera el cupo espera su turno en lugar de recibir un error", async () => {
    const { generateComicFromPayload } = await loadService({ MAX_CONCURRENT_COMIC_GENERATIONS: "1" });
    const release = holdImages();

    const first = generateComicFromPayload(distinct(1));
    const second = generateComicFromPayload(distinct(2));
    await flush();
    expect(imageCalls()).toHaveLength(6);

    release();
    await first;
    await flush();
    expect(imageCalls()).toHaveLength(12);

    release();
    await expect(second).resolves.toBeTruthy();
  });

  it("rechaza con 503 cuando la cola está llena", async () => {
    const { generateComicFromPayload } = await loadService({
      MAX_CONCURRENT_COMIC_GENERATIONS: "1",
      MAX_PENDING_COMIC_REQUESTS: "1",
    });
    const release = holdImages();

    const first = generateComicFromPayload(distinct(1));
    const second = generateComicFromPayload(distinct(2));
    const error = await rejection(generateComicFromPayload(distinct(3)));
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("server_overloaded");

    release();
    await first;
    await flush();
    release();
    await second;
  });

  it("quien agota la espera sale de la cola y no se pierde el turno del siguiente", async () => {
    const { generateComicFromPayload } = await loadService({
      MAX_CONCURRENT_COMIC_GENERATIONS: "1",
      CONCURRENCY_WAIT_TIMEOUT_MS: "30",
    });
    const release = holdImages();

    const first = generateComicFromPayload(distinct(1));
    const error = await rejection(generateComicFromPayload(distinct(2)));
    expect(error.code).toBe("concurrency_wait_timeout");

    const third = generateComicFromPayload(distinct(3));
    release();
    await first;
    await flush();
    expect(imageCalls()).toHaveLength(12);
    release();
    await expect(third).resolves.toBeTruthy();
  });

  it("el cupo sigue ocupado hasta que terminan todas las viñetas aunque una falle", async () => {
    const { generateComicFromPayload } = await loadService({
      MAX_CONCURRENT_COMIC_GENERATIONS: "1",
      MAX_PANEL_ATTEMPTS: "1",
    });
    const pending: Array<() => void> = [];
    let firstCall = true;
    fake.imageHandler = () => {
      if (firstCall) {
        firstCall = false;
        return Promise.reject(apiError(503));
      }
      return new Promise((resolve) => pending.push(() => resolve(imageResponse())));
    };

    const first = rejection(generateComicFromPayload(distinct(1)));
    const second = generateComicFromPayload(distinct(2));
    await flush();
    expect(imageCalls()).toHaveLength(6);

    while (pending.length) pending.shift()!();
    await first;
    await flush();
    expect(imageCalls()).toHaveLength(12);
    while (pending.length) pending.shift()!();
    await second;
  });

  it("no gasta nada si el cliente se fue mientras esperaba", async () => {
    const { generateComicFromPayload } = await loadService({ MAX_CONCURRENT_COMIC_GENERATIONS: "1" });
    const release = holdImages();
    const controller = new AbortController();

    const first = generateComicFromPayload(distinct(1));
    const second = rejection(generateComicFromPayload(distinct(2), { clientSignal: controller.signal }));
    await flush();
    controller.abort();
    release();
    await first;

    const error = await second;
    expect(error.statusCode).toBe(499);
    expect(imageCalls()).toHaveLength(6);
  });
});

describe("validación", () => {
  it.each([
    ["sin foto", { ...payload, photo: "" }, "missing_required_fields"],
    ["foto que no es imagen", { ...payload, photo: "data:text/html;base64,QUJD" }, "invalid_photo"],
    ["foto con base64 inválido", { ...payload, photo: "data:image/jpeg;base64,<script>" }, "invalid_photo"],
    ["nombre demasiado largo", { ...payload, userName: "a".repeat(61) }, "text_too_long"],
    ["texto demasiado largo", { ...payload, bestMoment: "a".repeat(401) }, "text_too_long"],
  ])("rechaza %s antes de gastar", async (_name, body, code) => {
    const { generateComicFromPayload } = await loadService();
    const error = await rejection(generateComicFromPayload(body));
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(code);
    expect(fake.calls).toHaveLength(0);
  });
});
