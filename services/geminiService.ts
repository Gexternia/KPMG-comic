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

// ──────────────────────────────────────────────
// Story type matching the new STORY_PROMPT output
// ──────────────────────────────────────────────
interface StoryOutput {
  p1_caption: string;
  p1_scene: string;
  p2_caption: string;
  p2_scene: string;
  p3_caption: string;
  p3_scene: string;
  p4_caption: string;
  p4_scene: string;
}

/**
 * Generate the text narrative (captions + scene descriptions)
 */
async function generateStory(userData: UserData): Promise<StoryOutput> {
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
        
        const parsed = JSON.parse(text) as StoryOutput;

        // Validate all fields exist
        const requiredKeys: (keyof StoryOutput)[] = [
          'p1_caption', 'p1_scene', 'p2_caption', 'p2_scene',
          'p3_caption', 'p3_scene', 'p4_caption', 'p4_scene'
        ];
        for (const key of requiredKeys) {
          if (!parsed[key] || typeof parsed[key] !== 'string') {
            throw new Error(`Missing or invalid story field: ${key}`);
          }
        }

        return parsed;
    } catch (e) {
        console.error("Story generation failed", e);
        // Fallback
        return {
            p1_caption: "La crisis amenaza...",
            p1_scene: "Character stares at a wall of screens showing declining graphs, looking worried.",
            p2_caption: "No hay salida...",
            p2_scene: "Character sits alone in a dark office, head in hands, papers scattered.",
            p3_caption: "¡Hay una oportunidad!",
            p3_scene: "Character stands up with determination, light breaking through the window.",
            p4_caption: "¡Victoria total!",
            p4_scene: "Character celebrates with arms raised, confetti falling, colleagues cheering."
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
  if (dataUrl) return dataUrl;

  const detail = describeImageResponseError(response);
  console.error("Gemini image response:", response);
  throw new Error(detail);
}

/**
 * Generate comic book (Images + Text)
 * 
 * Flow:
 * 1. Generate story + cover + back cover in parallel (these don't depend on each other)
 * 2. Once story is ready, generate panels 1-4 in parallel (these need captions + scenes)
 */
export async function generateComicBook(userData: UserData): Promise<ComicPages> {
  if (!userData.photo) throw new Error("Falta la foto del usuario");

  const { userName, photo, worstMoment, bestMoment } = userData;

  // ── Phase 1: Story + Cover + Back Cover in parallel ──
  const [story, cover, backCover] = await Promise.all([
    generateStory(userData),
    generatePanel(photo, COVER_PROMPT_TEMPLATE(userName)),
    generatePanel(photo, BACK_COVER_PROMPT_TEMPLATE(userName)),
  ]);

  console.log("Story generated:", story);

  // ── Phase 2: Panels 1-4 in parallel (now we have captions + scenes) ──
  const [p1, p2, p3, p4] = await Promise.all([
    generatePanel(photo, P1_PROMPT_TEMPLATE(userName, story.p1_caption, story.p1_scene)),
    generatePanel(photo, P2_PROMPT_TEMPLATE(userName, story.p2_caption, story.p2_scene, worstMoment)),
    generatePanel(photo, P3_PROMPT_TEMPLATE(userName, story.p3_caption, story.p3_scene)),
    generatePanel(photo, P4_PROMPT_TEMPLATE(userName, story.p4_caption, story.p4_scene, bestMoment)),
  ]);

  return {
    cover,
    p1,
    p2,
    p3,
    p4,
    backCover,
    captions: {
      p1: story.p1_caption,
      p2: story.p2_caption,
      p3: story.p3_caption,
      p4: story.p4_caption,
    }
  };
}