import { GoogleGenAI, Modality } from "@google/genai";
import {
  MODEL_NAME,
  TEXT_MODEL_NAME,
  STORY_PROMPT,
  COVER_PROMPT_TEMPLATE,
  BACK_COVER_PROMPT_TEMPLATE,
  P1_PROMPT_TEMPLATE,
  P2_PROMPT_TEMPLATE,
  P3_PROMPT_TEMPLATE,
  P4_PROMPT_TEMPLATE,
} from "../constants";
import { HttpError } from "./errors";

const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 60_000);
const MAX_CONCURRENT_COMIC_GENERATIONS = Number(process.env.MAX_CONCURRENT_COMIC_GENERATIONS || 2);
const CONCURRENCY_WAIT_TIMEOUT_MS = Number(process.env.CONCURRENCY_WAIT_TIMEOUT_MS || 8_000);
const MAX_PENDING_COMIC_REQUESTS = Number(process.env.MAX_PENDING_COMIC_REQUESTS || 20);

let activeComicGenerations = 0;
const pendingResolvers: Array<() => void> = [];

export interface ComicRequest {
  userName: string;
  worstMoment: string;
  bestMoment: string;
  photo: string;
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: HttpError): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(timeoutError), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function acquireGenerationSlot(): Promise<() => void> {
  if (activeComicGenerations < MAX_CONCURRENT_COMIC_GENERATIONS) {
    activeComicGenerations += 1;
    return () => releaseGenerationSlot();
  }

  if (pendingResolvers.length >= MAX_PENDING_COMIC_REQUESTS) {
    throw new HttpError(503, "Servidor ocupado. Intenta nuevamente en unos segundos.", "server_overloaded");
  }

  await withTimeout(
    new Promise<void>((resolve) => {
      pendingResolvers.push(resolve);
    }),
    CONCURRENCY_WAIT_TIMEOUT_MS,
    new HttpError(503, "Alta demanda en curso. Intenta nuevamente.", "concurrency_wait_timeout")
  );

  activeComicGenerations += 1;
  return () => releaseGenerationSlot();
}

function releaseGenerationSlot(): void {
  activeComicGenerations = Math.max(0, activeComicGenerations - 1);
  const next = pendingResolvers.shift();
  if (next) next();
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_API_KEY;
  if (!key) {
    throw new HttpError(503, "Configuración incompleta: falta GEMINI_API_KEY.", "config_missing_api_key");
  }
  return key;
}

function validateRequest(payload: unknown): ComicRequest {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Payload inválido", "invalid_payload");
  }
  const data = payload as Record<string, unknown>;
  const userName = typeof data.userName === "string" ? data.userName.trim() : "";
  const worstMoment = typeof data.worstMoment === "string" ? data.worstMoment.trim() : "";
  const bestMoment = typeof data.bestMoment === "string" ? data.bestMoment.trim() : "";
  const photo = typeof data.photo === "string" ? data.photo : "";

  if (!userName || !worstMoment || !bestMoment || !photo) {
    throw new HttpError(400, "Faltan campos obligatorios para generar el cómic", "missing_required_fields");
  }
  return { userName, worstMoment, bestMoment, photo };
}

function cleanBase64Image(image: string): string {
  return image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
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

function sanitizeCaptions(raw: unknown): StoryCaptions {
  const fallback: StoryCaptions = {
    p1: "Así empezó mi historia en KPMG.",
    p2: "Un momento que marcó mi aprendizaje.",
    p3: "Entre el reto y lo que más valoro.",
    p4: "Un recuerdo que me queda.",
  };

  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Record<string, unknown>;

  return {
    p1: typeof data.p1 === "string" ? data.p1 : fallback.p1,
    p2: typeof data.p2 === "string" ? data.p2 : fallback.p2,
    p3: typeof data.p3 === "string" ? data.p3 : fallback.p3,
    p4: typeof data.p4 === "string" ? data.p4 : fallback.p4,
  };
}

async function generateStory(ai: GoogleGenAI, payload: ComicRequest): Promise<StoryCaptions> {
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: TEXT_MODEL_NAME,
        contents: STORY_PROMPT({
          userName: payload.userName,
          worst: payload.worstMoment,
          best: payload.bestMoment,
        }),
        config: { responseMimeType: "application/json" },
      }),
      AI_REQUEST_TIMEOUT_MS,
      new HttpError(504, "Timeout al generar narrativa con IA.", "provider_timeout_story")
    );

    if (!response.text) return sanitizeCaptions(null);
    return sanitizeCaptions(JSON.parse(response.text));
  } catch {
    return sanitizeCaptions(null);
  }
}

async function generatePanel(ai: GoogleGenAI, base64Image: string, prompt: string): Promise<string> {
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      }),
      AI_REQUEST_TIMEOUT_MS,
      new HttpError(504, "Timeout al llamar al proveedor de IA.", "provider_timeout")
    );

    const image = extractImageDataUrl(response);
    if (!image) {
      throw new HttpError(502, "La IA no devolvió imagen válida.", "provider_invalid_image_response");
    }
    return image;
  } catch (error) {
    const err = error as { status?: number; code?: number | string; message?: string };
    const status = typeof err.status === "number" ? err.status : undefined;
    const code = err.code;
    const message = typeof err.message === "string" ? err.message.toLowerCase() : "";

    if (message.includes("timeout") || code === "ETIMEDOUT") {
      throw new HttpError(504, "Timeout al llamar al proveedor de IA.", "provider_timeout");
    }
    if (status === 429 || code === 429) {
      throw new HttpError(503, "Proveedor de IA saturado temporalmente.", "provider_rate_limited");
    }
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      throw new HttpError(503, "Proveedor de IA no disponible temporalmente.", "provider_unavailable");
    }
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "Error inesperado del proveedor de IA.", "provider_error");
  }
}

export async function generateComicFromPayload(rawPayload: unknown): Promise<ComicResponse> {
  const releaseSlot = await acquireGenerationSlot();
  try {
  const payload = validateRequest(rawPayload);
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const cleanImage = cleanBase64Image(payload.photo);

  const storyPromise = generateStory(ai, payload);
  const imagePromises = [
    generatePanel(ai, cleanImage, COVER_PROMPT_TEMPLATE(payload.userName)),
    generatePanel(ai, cleanImage, P1_PROMPT_TEMPLATE(payload.worstMoment, payload.bestMoment)),
    generatePanel(ai, cleanImage, P2_PROMPT_TEMPLATE(payload.worstMoment)),
    generatePanel(ai, cleanImage, P3_PROMPT_TEMPLATE(payload.worstMoment, payload.bestMoment)),
    generatePanel(ai, cleanImage, P4_PROMPT_TEMPLATE(payload.bestMoment)),
    generatePanel(ai, cleanImage, BACK_COVER_PROMPT_TEMPLATE()),
  ];

  const [captions, [cover, p1, p2, p3, p4, backCover]] = await Promise.all([
    storyPromise,
    Promise.all(imagePromises),
  ]);

  return {
    cover,
    p1,
    p2,
    p3,
    p4,
    backCover,
    captions,
  };
  } finally {
    releaseSlot();
  }
}
