import Replicate from "replicate";
import { HttpError } from "../errors";
import { envNumber, envString } from "../env";

/**
 * Modelos probados en Replicate (may 2026):
 * - black-forest-labs/flux-kontext-pro  → OK, buen parecido + edición por foto
 * - black-forest-labs/flux-2-max        → OK, mejores escenas
 * - tencentarc/photomaker-style       → 404 o error interno; se usa fallback
 */
export const REPLICATE_IMAGE_MODEL =
  envString("REPLICATE_IMAGE_MODEL") ?? "black-forest-labs/flux-kontext-pro";

const FALLBACK_MODEL = "black-forest-labs/flux-kontext-pro";

const REPLICATE_REQUEST_TIMEOUT_MS = envNumber("REPLICATE_REQUEST_TIMEOUT_MS", 180_000);
const REPLICATE_PANEL_CONCURRENCY = envNumber("REPLICATE_PANEL_CONCURRENCY", 3);
const PHOTOMAKER_STYLE_STRENGTH = envNumber("PHOTOMAKER_STYLE_STRENGTH", 30);
const PHOTOMAKER_GUIDANCE_SCALE = envNumber("PHOTOMAKER_GUIDANCE_SCALE", 5);
const PHOTOMAKER_NUM_STEPS = envNumber("PHOTOMAKER_NUM_STEPS", 50);

export type PanelKey = "cover" | "p1" | "p2" | "p3" | "p4" | "backCover";

export interface PanelDimensions {
  width: number;
  height: number;
}

export interface PanelInput {
  key: PanelKey;
  prompt: string;
  negativePrompt: string;
  dimensions: PanelDimensions;
}

export interface PanelResult {
  key: PanelKey;
  dataUri: string;
  generationMs: number;
}

const versionCache = new Map<string, string>();

function getReplicateClient(): Replicate {
  const token = envString("REPLICATE_API_TOKEN");
  if (!token) {
    throw new HttpError(
      503,
      "Configuración incompleta: falta REPLICATE_API_TOKEN.",
      "config_missing_replicate_token"
    );
  }
  return new Replicate({ auth: token });
}

function isPhotoMakerModel(model: string): boolean {
  return model.includes("photomaker");
}

function isKontextModel(model: string): boolean {
  return model.includes("kontext");
}

function dimensionsToAspectRatio(dimensions: PanelDimensions): string {
  const { width, height } = dimensions;
  if (width === height) return "1:1";
  if (width < height) return "3:4";
  if (width > height) return "4:3";
  return "1:1";
}

async function resolveModelId(model: string): Promise<string> {
  if (model.includes(":")) return model;

  const cached = versionCache.get(model);
  if (cached) return cached;

  const [owner, name] = model.split("/");
  if (!owner || !name) return model;

  try {
    const replicate = getReplicateClient();
    const meta = await replicate.models.get(owner, name);
    const version = meta.latest_version?.id;
    if (version) {
      const full = `${owner}/${name}:${version}`;
      versionCache.set(model, full);
      return full;
    }
  } catch {
    // Si falla metadata, usar slug corto
  }
  return model;
}

function buildModelInput(
  model: string,
  prompt: string,
  negativePrompt: string,
  photoDataUri: string,
  dimensions: PanelDimensions
): Record<string, unknown> {
  if (isPhotoMakerModel(model)) {
    return {
      prompt,
      negative_prompt: negativePrompt,
      input_image: photoDataUri,
      style_name: "(No style)",
      style_strength_ratio: PHOTOMAKER_STYLE_STRENGTH,
      num_steps: PHOTOMAKER_NUM_STEPS,
      num_outputs: 1,
      guidance_scale: PHOTOMAKER_GUIDANCE_SCALE,
    };
  }

  if (isKontextModel(model)) {
    return {
      prompt,
      input_image: photoDataUri,
      aspect_ratio: dimensionsToAspectRatio(dimensions),
      output_format: "jpg",
      safety_tolerance: 2,
    };
  }

  return {
    prompt,
    reference_images: [photoDataUri],
    aspect_ratio: dimensionsToAspectRatio(dimensions),
    output_format: "jpg",
    output_quality: 90,
    prompt_upsampling: false,
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: HttpError
): Promise<T> {
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

async function normalizeOutput(output: unknown): Promise<string> {
  if (typeof output === "string") return output;

  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof (first as { url?: unknown }).url === "function") {
      const u = await (first as { url: () => Promise<string> | string }).url();
      return typeof u === "string" ? u : u.toString();
    }
    if (first && typeof (first as { url?: string }).url === "string") {
      return (first as { url: string }).url;
    }
  }

  if (output && typeof (output as { url?: unknown }).url === "function") {
    const u = await (output as { url: () => Promise<string> | string }).url();
    return typeof u === "string" ? u : u.toString();
  }

  if (output && typeof (output as { url?: string }).url === "string") {
    return (output as { url: string }).url;
  }

  throw new HttpError(
    502,
    "La IA no devolvió imagen válida.",
    "provider_invalid_image_response"
  );
}

async function urlToDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpError(
      502,
      "Error al descargar imagen generada.",
      "provider_download_failed"
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function mapReplicateError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  const err = error as {
    status?: number;
    message?: string;
    name?: string;
    response?: { status?: number };
  };
  const status =
    typeof err.status === "number"
      ? err.status
      : typeof err.response?.status === "number"
        ? err.response.status
        : undefined;
  const rawMessage = typeof err.message === "string" ? err.message : "";
  const message = rawMessage.toLowerCase();

  console.error("[Replicate]", err.name ?? "Error", rawMessage.slice(0, 500));

  if (err.name === "AbortError" || message.includes("timeout")) {
    return new HttpError(504, "Timeout al llamar al proveedor de IA.", "provider_timeout");
  }
  if (status === 404) {
    return new HttpError(503, "Modelo de imagen no disponible en Replicate.", "provider_model_not_found");
  }
  if (status === 429) {
    return new HttpError(503, "Proveedor de IA saturado temporalmente.", "provider_rate_limited");
  }
  if (status === 401 || status === 403) {
    return new HttpError(503, "Configuración inválida del proveedor de IA.", "provider_auth_error");
  }
  if (status && status >= 500) {
    return new HttpError(503, "Proveedor de IA no disponible temporalmente.", "provider_unavailable");
  }
  if (message.startsWith("prediction failed:")) {
    const detail = rawMessage.replace(/^Prediction failed:\s*/i, "").trim();
    return new HttpError(
      502,
      detail || "La generación de imagen falló en el proveedor.",
      "provider_prediction_failed"
    );
  }
  if (rawMessage) {
    return new HttpError(502, rawMessage.slice(0, 300), "provider_error");
  }
  return new HttpError(502, "Error inesperado del proveedor de IA.", "provider_error");
}

async function runModel(
  model: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const replicate = getReplicateClient();
  const modelId = await resolveModelId(model);
  const replicatePromise = replicate.run(modelId, { input });
  return withTimeout(
    replicatePromise,
    REPLICATE_REQUEST_TIMEOUT_MS,
    new HttpError(504, "Timeout al generar imagen con Replicate.", "provider_timeout")
  );
}

export async function generatePanel(
  input: PanelInput,
  photoDataUri: string
): Promise<PanelResult> {
  const t0 = Date.now();
  const primaryModel = REPLICATE_IMAGE_MODEL;
  const modelInput = buildModelInput(
    primaryModel,
    input.prompt,
    input.negativePrompt,
    photoDataUri,
    input.dimensions
  );

  try {
    const output = await runModel(primaryModel, modelInput);
    const url = await normalizeOutput(output);
    const dataUri = await urlToDataUri(url);
    return { key: input.key, dataUri, generationMs: Date.now() - t0 };
  } catch (primaryError) {
    const shouldFallback =
      isPhotoMakerModel(primaryModel) &&
      primaryModel !== FALLBACK_MODEL;

    if (!shouldFallback) {
      throw mapReplicateError(primaryError);
    }

    console.warn(
      `[Replicate] PhotoMaker falló (${primaryError instanceof Error ? primaryError.message : primaryError}). Fallback → ${FALLBACK_MODEL}`
    );

    try {
      const fallbackInput = buildModelInput(
        FALLBACK_MODEL,
        input.prompt,
        input.negativePrompt,
        photoDataUri,
        input.dimensions
      );
      const output = await runModel(FALLBACK_MODEL, fallbackInput);
      const url = await normalizeOutput(output);
      const dataUri = await urlToDataUri(url);
      return { key: input.key, dataUri, generationMs: Date.now() - t0 };
    } catch (fallbackError) {
      throw mapReplicateError(fallbackError);
    }
  }
}

export async function generateAllPanels(
  panels: PanelInput[],
  photoDataUri: string
): Promise<PanelResult[]> {
  const results: PanelResult[] = [];
  const concurrency = Math.max(1, Math.min(REPLICATE_PANEL_CONCURRENCY, panels.length));

  for (let i = 0; i < panels.length; i += concurrency) {
    const batch = panels.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((panel) => generatePanel(panel, photoDataUri))
    );
    results.push(...batchResults);
  }

  return results;
}
