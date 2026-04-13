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
  P4_PROMPT_TEMPLATE
} from '../constants';
import { UserData, ComicPages } from '../types';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || "dummy_key" });

/**
 * Generate the text narrative (captions)
 */
async function generateStory(userData: UserData): Promise<{p1: string, p2: string, p3: string, p4: string}> {
    try {
        const response = await ai.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: STORY_PROMPT({
                userName: userData.userName,
                worst: userData.worstMoment,
                best: userData.bestMoment
            }),
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) throw new Error("No story generated");
        
        return JSON.parse(text);
    } catch (e) {
        console.error("Story generation failed", e);
        // Fallback text
        return {
            p1: "Así empezó mi historia en KPMG.",
            p2: "Un momento que marcó mi aprendizaje.",
            p3: "Entre el reto y lo que más valoro.",
            p4: "Un recuerdo que me queda."
        };
    }
}

function extractImageDataUrl(response: {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    finishReason?: string;
    finishMessage?: string;
  }>;
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
}): string | null {
  for (const candidate of response.candidates ?? []) {
    const parts = candidate.content?.parts;
    if (!parts?.length) continue;
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) {
        const mime =
          part.inlineData?.mimeType && part.inlineData.mimeType.startsWith("image/")
            ? part.inlineData.mimeType
            : "image/png";
        return `data:${mime};base64,${data}`;
      }
    }
  }
  return null;
}

function describeImageResponseError(response: {
  candidates?: Array<{
    content?: { parts?: unknown[] };
    finishReason?: string;
    finishMessage?: string;
  }>;
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
}): string {
  const block = response.promptFeedback?.blockReason;
  if (block) {
    return `El prompt fue bloqueado (${block}). Prueba con otra foto o reformula el texto.`;
  }
  const c0 = response.candidates?.[0];
  if (!c0) return "La API no devolvió ninguna respuesta.";
  if (!c0.content?.parts?.length) {
    const r = c0.finishReason ?? "desconocido";
    const m = c0.finishMessage ? ` ${c0.finishMessage}` : "";
    return `La IA no devolvió imagen (motivo: ${r}).${m}`;
  }
  return "No se encontró datos de imagen en la respuesta.";
}

/**
 * Detects and crops letterbox/white borders baked into an AI-generated image.
 * Scans edge pixels; if significant white borders found, crops them out.
 * Returns a clean data URL (original untouched if no borders detected).
 */
async function cropWhiteBorders(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0);

      const { width, height } = canvas;
      const imageData = ctx.getImageData(0, 0, width, height).data;

      const isBg = (x: number, y: number): boolean => {
        const idx = (y * width + x) * 4;
        const r = imageData[idx], g = imageData[idx + 1], b = imageData[idx + 2];
        return (r > 200 && g > 200 && b > 200) || (r < 50 && g < 50 && b < 50);
      };

      const rowIsBorder = (y: number): boolean => {
        let count = 0;
        for (let x = 0; x < width; x++) if (isBg(x, y)) count++;
        return count > width * 0.85;
      };

      const colIsBorder = (x: number): boolean => {
        let count = 0;
        for (let y = 0; y < height; y++) if (isBg(x, y)) count++;
        return count > height * 0.85;
      };

      let top = 0; while (top < height && rowIsBorder(top)) top++;
      let bottom = 0; while (bottom < height && rowIsBorder(height - 1 - bottom)) bottom++;
      let left = 0; while (left < width && colIsBorder(left)) left++;
      let right = 0; while (right < width && colIsBorder(width - 1 - right)) right++;

      const threshold = Math.min(width, height) * 0.01;
      if (top < threshold && bottom < threshold && left < threshold && right < threshold) {
        resolve(dataUrl);
        return;
      }

      const cropX = left;
      const cropY = top;
      const cropW = width - left - right;
      const cropH = height - top - bottom;

      if (cropW <= 0 || cropH <= 0) { resolve(dataUrl); return; }

      const out = document.createElement('canvas');
      out.width = cropW;
      out.height = cropH;
      const outCtx = out.getContext('2d');
      if (!outCtx) { resolve(dataUrl); return; }
      outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      console.info(`[cropWhiteBorders] Cropped borders: top=${top} bottom=${bottom} left=${left} right=${right}`);
      resolve(out.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Helper to generate a single panel image
 */
async function generatePanel(base64Image: string, prompt: string): Promise<string> {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const dataUrl = extractImageDataUrl(response);
  if (dataUrl) return cropWhiteBorders(dataUrl);

  const detail = describeImageResponseError(response);
  console.error("Gemini image response:", response);
  throw new Error(detail);
}

/**
 * Generate comic book (Images + Text)
 */
export async function generateComicBook(userData: UserData): Promise<ComicPages> {
  if (!userData.photo) throw new Error("Falta la foto del usuario");

  // 1. Start generating text and images in parallel
  const storyPromise = generateStory(userData);
  
  const imagePromises = [
    generatePanel(userData.photo, COVER_PROMPT_TEMPLATE(userData.userName)),
    generatePanel(userData.photo, P1_PROMPT_TEMPLATE(userData.worstMoment, userData.bestMoment)),
    generatePanel(userData.photo, P2_PROMPT_TEMPLATE(userData.worstMoment)),
    generatePanel(userData.photo, P3_PROMPT_TEMPLATE(userData.worstMoment, userData.bestMoment)),
    generatePanel(userData.photo, P4_PROMPT_TEMPLATE(userData.bestMoment)),
    generatePanel(userData.photo, BACK_COVER_PROMPT_TEMPLATE())
  ];

  // 2. Wait for all
  const [captions, [cover, p1, p2, p3, p4, backCover]] = await Promise.all([
      storyPromise,
      Promise.all(imagePromises)
  ]);

  return {
    cover,
    p1,
    p2,
    p3,
    p4,
    backCover,
    captions
  };
}
