import { createHash } from "node:crypto";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  MODEL_NAME,
  TEXT_MODEL_NAME,
  PANEL_ASPECT_RATIO,
  MAX_USER_NAME_LENGTH,
  MAX_STORY_TEXT_LENGTH,
  STORY_PROMPT,
  COVER_PROMPT_TEMPLATE,
  BACK_COVER_PROMPT_TEMPLATE,
  P1_PROMPT_TEMPLATE,
  P2_PROMPT_TEMPLATE,
  P3_PROMPT_TEMPLATE,
  P4_PROMPT_TEMPLATE,
} from "../constants";
import { envNumber } from "./env";
import { HttpError, isHttpError } from "./errors";
import { logWarn } from "./logger";
import { recordAiCall, recordPanelCacheHit } from "./metrics";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || MODEL_NAME;
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || TEXT_MODEL_NAME;

const AI_REQUEST_TIMEOUT_MS = envNumber("AI_REQUEST_TIMEOUT_MS", 90_000);
const STORY_REQUEST_TIMEOUT_MS = envNumber("STORY_REQUEST_TIMEOUT_MS", 30_000);
const COMIC_DEADLINE_MS = envNumber("COMIC_DEADLINE_MS", 270_000);
const MAX_PANEL_ATTEMPTS = envNumber("MAX_PANEL_ATTEMPTS", 3);
const AI_RETRY_BACKOFF_MS = envNumber("AI_RETRY_BACKOFF_MS", 1_000);
const MAX_CONCURRENT_COMIC_GENERATIONS = envNumber("MAX_CONCURRENT_COMIC_GENERATIONS", 4);
const CONCURRENCY_WAIT_TIMEOUT_MS = envNumber("CONCURRENCY_WAIT_TIMEOUT_MS", 90_000);
const MAX_PENDING_COMIC_REQUESTS = envNumber("MAX_PENDING_COMIC_REQUESTS", 20);
const MAX_IMAGE_CALLS_PER_HOUR = envNumber("MAX_IMAGE_CALLS_PER_HOUR", 1_800);
const PANEL_CACHE_TTL_MS = envNumber("PANEL_CACHE_TTL_MS", 30 * 60_000);
const PANEL_CACHE_MAX_BYTES = envNumber("PANEL_CACHE_MAX_BYTES", 128 * 1024 * 1024);

const MAX_PHOTO_BASE64_LENGTH = 8 * 1024 * 1024;
const MIN_ATTEMPT_WINDOW_MS = 5_000;
const MAX_TIMEOUT_ATTEMPTS = 2;
const STORY_ATTEMPTS = 2;
const MAX_CAPTION_LENGTH = 160;
const RATE_LIMIT_COOLDOWN_MS = 15_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 60_000;
const KEY_DISABLED_COOLDOWN_MS = 10 * 60_000;
const ONE_HOUR_MS = 60 * 60_000;

const PANEL_NAMES = ["cover", "p1", "p2", "p3", "p4", "backCover"] as const;

let activeComicGenerations = 0;
const pendingWaiters: Array<() => void> = [];

export interface ComicRequest {
  userName: string;
  worstMoment: string;
  bestMoment: string;
  photo: PhotoInput;
}

interface PhotoInput {
  mimeType: string;
  data: string;
}

interface StoryCaptions {
  p1: string;
  p2: string;
  p3: string;
  p4: string;
}

export interface ComicResponse {
  cover: string;
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  backCover: string;
  captions: StoryCaptions;
}

export interface GenerateComicOptions {
  requestId?: string;
  clientSignal?: AbortSignal;
}

interface ApiKeySlot {
  index: number;
  ai: GoogleGenAI;
  cooldownUntilMs: number;
  cooldownError?: HttpError;
}

interface ProviderFailure {
  kind: string;
  error: HttpError;
  retryable: boolean;
  keyCooldownMs?: number;
}

interface FailoverRequest<T> {
  kind: "image" | "text";
  label: string;
  preferredKeyIndex: number;
  deadlineMs: number;
  maxAttempts: number;
  requestId: string;
  call: (ai: GoogleGenAI, timeoutMs: number) => Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutError: HttpError
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(timeoutError);
      }, timeoutMs);
    });
    return await Promise.race([run(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function acquireGenerationSlot(): Promise<() => void> {
  if (activeComicGenerations < MAX_CONCURRENT_COMIC_GENERATIONS) {
    activeComicGenerations += 1;
    return releaseGenerationSlot;
  }

  if (pendingWaiters.length >= MAX_PENDING_COMIC_REQUESTS) {
    throw new HttpError(503, "Servidor ocupado. Intenta nuevamente en unos segundos.", "server_overloaded");
  }

  await new Promise<void>((resolve, reject) => {
    const waiter = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      const position = pendingWaiters.indexOf(waiter);
      if (position >= 0) pendingWaiters.splice(position, 1);
      reject(new HttpError(503, "Alta demanda en curso. Intenta nuevamente.", "concurrency_wait_timeout"));
    }, CONCURRENCY_WAIT_TIMEOUT_MS);
    pendingWaiters.push(waiter);
  });

  // El cupo lo cede directamente quien termina, sin pasar por el contador.
  return releaseGenerationSlot;
}

function releaseGenerationSlot(): void {
  const next = pendingWaiters.shift();
  if (next) {
    next();
    return;
  }
  activeComicGenerations = Math.max(0, activeComicGenerations - 1);
}

let imageBudgetWindowStartMs = 0;
let imageCallsInWindow = 0;

function consumeImageBudget(): void {
  const now = Date.now();
  if (now - imageBudgetWindowStartMs >= ONE_HOUR_MS) {
    imageBudgetWindowStartMs = now;
    imageCallsInWindow = 0;
  }
  if (imageCallsInWindow >= MAX_IMAGE_CALLS_PER_HOUR) {
    throw new HttpError(
      503,
      "Se alcanzó el límite de generación por hora. Intenta más tarde.",
      "generation_budget_exceeded"
    );
  }
  imageCallsInWindow += 1;
}

function getGeminiApiKeys(): string[] {
  const primaryKey =
    process.env.GEMINI_API_KEY_1 ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_API_KEY;
  const secondaryKey = process.env.GEMINI_API_KEY_2;

  if (!primaryKey) {
    throw new HttpError(503, "Configuración incompleta: falta GEMINI_API_KEY_1 o GEMINI_API_KEY.", "config_missing_api_key");
  }

  return secondaryKey ? [primaryKey, secondaryKey] : [primaryKey];
}

let apiKeySlots: ApiKeySlot[] | null = null;

function getApiKeySlots(): ApiKeySlot[] {
  if (!apiKeySlots) {
    apiKeySlots = getGeminiApiKeys().map((apiKey, index) => ({
      index,
      ai: new GoogleGenAI({ apiKey }),
      cooldownUntilMs: 0,
    }));
  }
  return apiKeySlots;
}

/** Devuelve la primera clave disponible a partir de la preferida; si ninguna lo está, la que antes se libere. */
function pickKeySlot(slots: ApiKeySlot[], preferredIndex: number): ApiKeySlot {
  const now = Date.now();
  const ordered = slots.map((_, offset) => slots[(preferredIndex + offset) % slots.length]);
  return (
    ordered.find((slot) => slot.cooldownUntilMs <= now) ??
    ordered.reduce((soonest, slot) => (slot.cooldownUntilMs < soonest.cooldownUntilMs ? slot : soonest))
  );
}

function parseRetryDelayMs(message: string): number {
  const match = message.match(/retry in ([\d.]+)\s*s/i) ?? message.match(/retrydelay"?\s*:\s*"?([\d.]+)s/i);
  const delayMs = match ? Math.ceil(Number(match[1]) * 1000) : RATE_LIMIT_COOLDOWN_MS;
  return Math.min(delayMs, MAX_RATE_LIMIT_COOLDOWN_MS);
}

function classifyProviderError(error: unknown): ProviderFailure {
  if (isHttpError(error)) {
    const retryable =
      error.code === "provider_timeout" ||
      error.code === "provider_invalid_image_response" ||
      error.code === "provider_image_blocked";
    return { kind: error.code, error, retryable };
  }

  const err = error as { status?: number; code?: number | string; message?: string; name?: string };
  const status = typeof err.status === "number" ? err.status : typeof err.code === "number" ? err.code : undefined;
  const rawMessage = typeof err.message === "string" ? err.message : "";
  const message = rawMessage.toLowerCase();

  if (err.name === "AbortError" || message.includes("timeout") || err.code === "ETIMEDOUT") {
    return {
      kind: "provider_timeout",
      error: new HttpError(504, "Timeout al llamar al proveedor de IA.", "provider_timeout"),
      retryable: true,
    };
  }
  if (status === 401 || status === 403 || (status === 400 && message.includes("api key"))) {
    return {
      kind: "provider_auth",
      error: new HttpError(503, "Hay un problema con la clave del proveedor de IA.", "provider_auth"),
      retryable: true,
      keyCooldownMs: KEY_DISABLED_COOLDOWN_MS,
    };
  }
  if (status === 429) {
    if (/per ?day|spending cap|prepay|credits|billing/.test(message)) {
      return {
        kind: "provider_quota_exhausted",
        error: new HttpError(503, "Se agotó la cuota del proveedor de IA.", "provider_quota_exhausted"),
        retryable: true,
        keyCooldownMs: KEY_DISABLED_COOLDOWN_MS,
      };
    }
    return {
      kind: "provider_rate_limited",
      error: new HttpError(503, "Proveedor de IA saturado temporalmente.", "provider_rate_limited"),
      retryable: true,
      keyCooldownMs: parseRetryDelayMs(rawMessage),
    };
  }
  if (status === 404) {
    return {
      kind: "provider_model_unavailable",
      error: new HttpError(503, "El modelo de IA configurado no está disponible.", "provider_model_unavailable"),
      retryable: false,
    };
  }
  if (status === 400 || status === 422) {
    return {
      kind: "provider_bad_request",
      error: new HttpError(422, "La IA no pudo procesar la foto o los textos. Prueba con otra foto.", "provider_bad_request"),
      retryable: false,
    };
  }
  if (status !== undefined && status >= 500) {
    return {
      kind: "provider_unavailable",
      error: new HttpError(503, "Proveedor de IA no disponible temporalmente.", "provider_unavailable"),
      retryable: true,
    };
  }
  return {
    kind: "provider_error",
    error: new HttpError(502, "Error inesperado del proveedor de IA.", "provider_error"),
    retryable: true,
  };
}

async function callWithKeyFailover<T>(request: FailoverRequest<T>): Promise<T> {
  const slots = getApiKeySlots();
  let lastError: HttpError | undefined;
  let timeoutAttempts = 0;

  for (let attempt = 0; attempt < request.maxAttempts; attempt += 1) {
    const slot = pickKeySlot(slots, request.preferredKeyIndex + attempt);
    const cooldownMs = slot.cooldownUntilMs - Date.now();

    if (cooldownMs > 0) {
      // Ninguna clave disponible: solo se espera si aún queda margen; si no, se falla sin gastar.
      if (Date.now() + cooldownMs + MIN_ATTEMPT_WINDOW_MS >= request.deadlineMs) {
        throw lastError ?? slot.cooldownError ?? new HttpError(503, "Proveedor de IA saturado temporalmente.", "provider_rate_limited");
      }
      await sleep(cooldownMs);
    }

    const remainingMs = request.deadlineMs - Date.now();
    if (remainingMs < MIN_ATTEMPT_WINDOW_MS) break;

    try {
      if (request.kind === "image") consumeImageBudget();
      const result = await request.call(slot.ai, Math.min(AI_REQUEST_TIMEOUT_MS, remainingMs));
      recordAiCall(request.kind, slot.index, "ok");
      return result;
    } catch (error) {
      const failure = classifyProviderError(error);
      recordAiCall(request.kind, slot.index, failure.kind);
      void logWarn("comic.ai_call.failed", request.requestId, {
        label: request.label,
        kind: failure.kind,
        keyIndex: slot.index,
        attempt: attempt + 1,
        retryable: failure.retryable,
      });

      if (failure.keyCooldownMs) {
        slot.cooldownUntilMs = Date.now() + failure.keyCooldownMs;
        slot.cooldownError = failure.error;
      }
      if (!failure.retryable) throw failure.error;

      // Una petición que agota el tiempo puede haberse cobrado: solo se repite una vez.
      if (failure.kind === "provider_timeout") {
        timeoutAttempts += 1;
        if (timeoutAttempts >= MAX_TIMEOUT_ATTEMPTS) throw failure.error;
      }

      lastError = failure.error;
      if (attempt < request.maxAttempts - 1) {
        await sleep(AI_RETRY_BACKOFF_MS * 2 ** attempt);
      }
    }
  }

  throw lastError ?? new HttpError(504, "Timeout al llamar al proveedor de IA.", "provider_timeout");
}

function validatePhoto(photo: unknown): PhotoInput {
  const match = typeof photo === "string" ? photo.match(/^data:image\/(png|jpe?g|webp);base64,/) : null;
  if (!match || typeof photo !== "string") {
    throw new HttpError(400, "La foto no tiene un formato válido.", "invalid_photo");
  }
  const data = photo.slice(match[0].length);
  if (data.length > MAX_PHOTO_BASE64_LENGTH) {
    throw new HttpError(413, "La foto es demasiado grande.", "photo_too_large");
  }
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new HttpError(400, "La foto no tiene un formato válido.", "invalid_photo");
  }
  return { mimeType: match[1] === "jpg" ? "image/jpeg" : `image/${match[1]}`, data };
}

function validateRequest(payload: unknown): ComicRequest {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Payload inválido", "invalid_payload");
  }
  const data = payload as Record<string, unknown>;
  const userName = typeof data.userName === "string" ? data.userName.trim() : "";
  const worstMoment = typeof data.worstMoment === "string" ? data.worstMoment.trim() : "";
  const bestMoment = typeof data.bestMoment === "string" ? data.bestMoment.trim() : "";

  if (!userName || !worstMoment || !bestMoment || !data.photo) {
    throw new HttpError(400, "Faltan campos obligatorios para generar el cómic", "missing_required_fields");
  }
  if (
    userName.length > MAX_USER_NAME_LENGTH ||
    worstMoment.length > MAX_STORY_TEXT_LENGTH ||
    bestMoment.length > MAX_STORY_TEXT_LENGTH
  ) {
    throw new HttpError(400, "Alguno de los textos es demasiado largo.", "text_too_long");
  }
  return { userName, worstMoment, bestMoment, photo: validatePhoto(data.photo) };
}

function extractImageDataUrl(response: {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
  }>;
}): string | null {
  for (const candidate of response.candidates ?? []) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) {
        const mime = part.inlineData?.mimeType?.startsWith("image/") ? part.inlineData.mimeType : "image/png";
        return `data:${mime};base64,${data}`;
      }
    }
  }
  return null;
}

function missingImageError(response: {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{ finishReason?: string }>;
}): HttpError {
  if (response.promptFeedback?.blockReason) {
    return new HttpError(
      422,
      "La IA rechazó la petición por su contenido. Prueba a reformular tus textos o a usar otra foto.",
      "provider_prompt_blocked"
    );
  }
  const finishReason = response.candidates?.[0]?.finishReason ?? "";
  if (/SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/.test(finishReason)) {
    return new HttpError(
      422,
      "La IA no quiso dibujar una de las viñetas. Prueba a reformular tus textos o a usar otra foto.",
      "provider_image_blocked"
    );
  }
  return new HttpError(502, "La IA no devolvió imagen válida.", "provider_invalid_image_response");
}

function sanitizeCaptions(raw: unknown): StoryCaptions {
  const fallback: StoryCaptions = {
    p1: "Así empezó mi historia en KPMG.",
    p2: "Un momento que marcó mi aprendizaje.",
    p3: "Entre el reto y lo que más valoro.",
    p4: "Un recuerdo que me queda.",
  };

  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Record<string, unknown>;
  const caption = (value: unknown, defaultValue: string): string => {
    const text = typeof value === "string" ? value.trim() : "";
    return text ? text.slice(0, MAX_CAPTION_LENGTH) : defaultValue;
  };

  return {
    p1: caption(data.p1, fallback.p1),
    p2: caption(data.p2, fallback.p2),
    p3: caption(data.p3, fallback.p3),
    p4: caption(data.p4, fallback.p4),
  };
}

async function generateStory(payload: ComicRequest, deadlineMs: number, requestId: string): Promise<StoryCaptions> {
  try {
    return await callWithKeyFailover({
      kind: "text",
      label: "story",
      preferredKeyIndex: 0,
      deadlineMs,
      maxAttempts: STORY_ATTEMPTS,
      requestId,
      call: async (ai, timeoutMs) => {
        const response = await withTimeout(
          (abortSignal) =>
            ai.models.generateContent({
              model: TEXT_MODEL,
              contents: STORY_PROMPT({
                userName: payload.userName,
                worst: payload.worstMoment,
                best: payload.bestMoment,
              }),
              config: { responseMimeType: "application/json", abortSignal },
            }),
          Math.min(timeoutMs, STORY_REQUEST_TIMEOUT_MS),
          new HttpError(504, "Timeout al generar narrativa con IA.", "provider_timeout")
        );
        return sanitizeCaptions(JSON.parse(response.text ?? ""));
      },
    });
  } catch (error) {
    // Unos textos genéricos no justifican perder las imágenes ya pagadas.
    void logWarn("comic.story.fallback", requestId, {
      kind: isHttpError(error) ? error.code : "unknown",
    });
    return sanitizeCaptions(null);
  }
}

async function requestPanel(ai: GoogleGenAI, photo: PhotoInput, prompt: string, timeoutMs: number): Promise<string> {
  const response = await withTimeout(
    (abortSignal) =>
      ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: photo.mimeType,
                  data: photo.data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.IMAGE],
          imageConfig: { aspectRatio: PANEL_ASPECT_RATIO },
          abortSignal,
        },
      }),
    timeoutMs,
    new HttpError(504, "Timeout al llamar al proveedor de IA.", "provider_timeout")
  );

  const image = extractImageDataUrl(response);
  if (!image) throw missingImageError(response);
  return image;
}

// Las viñetas ya pagadas se guardan un tiempo: si el cómic falla por una sola imagen,
// al reintentar únicamente se generan las que faltan.
const panelCache = new Map<string, { image: string; expiresAtMs: number }>();
const panelsInFlight = new Map<string, Promise<string>>();
let panelCacheBytes = 0;

function deleteCachedPanel(key: string): void {
  const entry = panelCache.get(key);
  if (!entry) return;
  panelCacheBytes -= entry.image.length;
  panelCache.delete(key);
}

function readCachedPanel(key: string): string | null {
  const entry = panelCache.get(key);
  if (!entry) return null;
  if (entry.expiresAtMs <= Date.now()) {
    deleteCachedPanel(key);
    return null;
  }
  panelCache.delete(key);
  panelCache.set(key, entry);
  return entry.image;
}

function storeCachedPanel(key: string, image: string): void {
  const now = Date.now();
  deleteCachedPanel(key);
  panelCache.set(key, { image, expiresAtMs: now + PANEL_CACHE_TTL_MS });
  panelCacheBytes += image.length;

  for (const [cachedKey, entry] of panelCache.entries()) {
    if (entry.expiresAtMs > now && panelCacheBytes <= PANEL_CACHE_MAX_BYTES) break;
    deleteCachedPanel(cachedKey);
  }
}

function generatePanel(
  photo: PhotoInput,
  prompt: string,
  label: string,
  position: number,
  deadlineMs: number,
  requestId: string
): Promise<string> {
  const key = createHash("sha256").update(IMAGE_MODEL).update(photo.data).update(prompt).digest("hex");

  const cached = readCachedPanel(key);
  if (cached) {
    recordPanelCacheHit();
    return Promise.resolve(cached);
  }

  const inFlight = panelsInFlight.get(key);
  if (inFlight) return inFlight;

  const task = callWithKeyFailover({
    kind: "image",
    label,
    preferredKeyIndex: position,
    deadlineMs,
    maxAttempts: MAX_PANEL_ATTEMPTS,
    requestId,
    call: (ai, timeoutMs) => requestPanel(ai, photo, prompt, timeoutMs),
  })
    .then((image) => {
      storeCachedPanel(key, image);
      return image;
    })
    .finally(() => panelsInFlight.delete(key));

  panelsInFlight.set(key, task);
  return task;
}

export async function generateComicFromPayload(
  rawPayload: unknown,
  options: GenerateComicOptions = {}
): Promise<ComicResponse> {
  const requestId = options.requestId ?? "unknown";
  const deadlineMs = Date.now() + COMIC_DEADLINE_MS;
  const payload = validateRequest(rawPayload);
  getApiKeySlots();

  const releaseSlot = await acquireGenerationSlot();
  try {
    // Quien cerró la página mientras hacía cola no debe gastar nada.
    if (options.clientSignal?.aborted) {
      throw new HttpError(499, "El cliente canceló la solicitud.", "client_disconnected");
    }

    const panelPrompts = [
      COVER_PROMPT_TEMPLATE(payload.userName),
      P1_PROMPT_TEMPLATE(payload.worstMoment, payload.bestMoment),
      P2_PROMPT_TEMPLATE(payload.worstMoment),
      P3_PROMPT_TEMPLATE(payload.worstMoment, payload.bestMoment),
      P4_PROMPT_TEMPLATE(payload.bestMoment),
      BACK_COVER_PROMPT_TEMPLATE(),
    ];

    const storyPromise = generateStory(payload, deadlineMs, requestId);
    // allSettled mantiene el cupo ocupado hasta que terminan todas las viñetas
    // y deja guardadas las que salieron bien aunque otra falle.
    const panelResults = await Promise.allSettled(
      panelPrompts.map((prompt, index) =>
        generatePanel(payload.photo, prompt, PANEL_NAMES[index], index, deadlineMs, requestId)
      )
    );
    const captions = await storyPromise;

    const images: string[] = [];
    const failures: unknown[] = [];
    for (const result of panelResults) {
      if (result.status === "fulfilled") images.push(result.value);
      else failures.push(result.reason);
    }

    if (failures.length > 0) {
      const firstFailure = classifyProviderError(failures[0]).error;
      const savedNote =
        images.length > 0
          ? ` Ya tenemos ${images.length} de ${panelPrompts.length} viñetas guardadas: al reintentar solo se dibujarán las que faltan.`
          : "";
      throw new HttpError(firstFailure.statusCode, `${firstFailure.message}${savedNote}`, firstFailure.code);
    }

    const [cover, p1, p2, p3, p4, backCover] = images;
    return { cover, p1, p2, p3, p4, backCover, captions };
  } finally {
    releaseSlot();
  }
}
