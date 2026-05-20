import OpenAI from "openai";
import {
  TEXT_MODEL_NAME,
  STORY_PROMPT,
  COVER_PROMPT_TEMPLATE,
  BACK_COVER_PROMPT_TEMPLATE,
  P1_PROMPT_TEMPLATE,
  P2_PROMPT_TEMPLATE,
  P3_PROMPT_TEMPLATE,
  P4_PROMPT_TEMPLATE,
  COVER_DIMENSIONS,
  PANEL_DIMENSIONS,
  BACK_COVER_DIMENSIONS,
} from "../constants";
import { HttpError } from "./errors";
import { envNumber, envString } from "./env";
import { generateAllPanels, type PanelInput } from "./providers/replicateImages";

const TEXT_REQUEST_TIMEOUT_MS = envNumber("AI_REQUEST_TIMEOUT_MS", 60_000);
const MAX_CONCURRENT_COMIC_GENERATIONS = envNumber("MAX_CONCURRENT_COMIC_GENERATIONS", 2);
const CONCURRENCY_WAIT_TIMEOUT_MS = envNumber("CONCURRENCY_WAIT_TIMEOUT_MS", 8_000);
const MAX_PENDING_COMIC_REQUESTS = envNumber("MAX_PENDING_COMIC_REQUESTS", 20);

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

function getOpenAIApiKey(): string {
  const key = envString("OPENAI_API_KEY");

  if (!key) {
    throw new HttpError(503, "Configuración incompleta: falta OPENAI_API_KEY.", "config_missing_openai_api_key");
  }
  return key;
}

function getTextModelName(): string {
  return envString("OPENAI_TEXT_MODEL") ?? TEXT_MODEL_NAME;
}

function validateReplicateConfig(): void {
  if (!envString("REPLICATE_API_TOKEN")) {
    throw new HttpError(503, "Configuración incompleta: falta REPLICATE_API_TOKEN.", "config_missing_replicate_token");
  }
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

function ensurePhotoIsDataUri(photo: string): string {
  if (photo.startsWith("data:")) return photo;
  return `data:image/jpeg;base64,${photo}`;
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

async function generateStory(ai: OpenAI, payload: ComicRequest): Promise<StoryCaptions> {
  try {
    const response = await withTimeout(
      ai.chat.completions.create({
        model: getTextModelName(),
        messages: [
          {
            role: "user",
            content: STORY_PROMPT({
              userName: payload.userName,
              worst: payload.worstMoment,
              best: payload.bestMoment,
            }),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
      TEXT_REQUEST_TIMEOUT_MS,
      new HttpError(504, "Timeout al generar narrativa con IA.", "provider_timeout_story")
    );

    const content = response.choices[0]?.message?.content;
    if (!content) return sanitizeCaptions(null);
    return sanitizeCaptions(JSON.parse(content));
  } catch {
    return sanitizeCaptions(null);
  }
}

function buildPanelInputs(payload: ComicRequest): PanelInput[] {
  return [
    {
      key: "cover",
      prompt: COVER_PROMPT_TEMPLATE(payload.userName),
      dimensions: COVER_DIMENSIONS,
    },
    {
      key: "p1",
      prompt: P1_PROMPT_TEMPLATE(payload.worstMoment, payload.bestMoment),
      dimensions: PANEL_DIMENSIONS,
    },
    {
      key: "p2",
      prompt: P2_PROMPT_TEMPLATE(payload.worstMoment),
      dimensions: PANEL_DIMENSIONS,
    },
    {
      key: "p3",
      prompt: P3_PROMPT_TEMPLATE(payload.worstMoment, payload.bestMoment),
      dimensions: PANEL_DIMENSIONS,
    },
    {
      key: "p4",
      prompt: P4_PROMPT_TEMPLATE(payload.bestMoment),
      dimensions: PANEL_DIMENSIONS,
    },
    {
      key: "backCover",
      prompt: BACK_COVER_PROMPT_TEMPLATE(),
      dimensions: BACK_COVER_DIMENSIONS,
    },
  ];
}

export async function generateComicFromPayload(rawPayload: unknown): Promise<ComicResponse> {
  const releaseSlot = await acquireGenerationSlot();
  try {
    const payload = validateRequest(rawPayload);

    validateReplicateConfig();
    const ai = new OpenAI({ apiKey: getOpenAIApiKey() });

    const photoDataUri = ensurePhotoIsDataUri(payload.photo);
    const panels = buildPanelInputs(payload);

    const [captions, panelResults] = await Promise.all([
      generateStory(ai, payload),
      generateAllPanels(panels, photoDataUri),
    ]);

    const byKey: Record<string, string> = {};
    for (const result of panelResults) {
      byKey[result.key] = result.dataUri;
    }

    return {
      cover: byKey.cover,
      p1: byKey.p1,
      p2: byKey.p2,
      p3: byKey.p3,
      p4: byKey.p4,
      backCover: byKey.backCover,
      captions,
    };
  } finally {
    releaseSlot();
  }
}
