import { GoogleGenAI} from "@google/genai";
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
            p1: "Todo comenzó con una idea...",
            p2: "Pero algo oscuro se acercaba...",
            p3: "¡El desastre golpeó con fuerza!",
            p4: "¿Es este el final de todo?"
        };
    }
}

/**
 * Helper to generate a single panel image
 */
async function generatePanel(base64Image: string, prompt: string): Promise<string> {
  try {
    // Strip header if present to get raw base64
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    // Check for image in response
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    // Fallback if no image found
    throw new Error("No image generated.");

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
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
    generatePanel(userData.photo, P1_PROMPT_TEMPLATE()),
    generatePanel(userData.photo, P2_PROMPT_TEMPLATE(userData.worstMoment)),
    generatePanel(userData.photo, P3_PROMPT_TEMPLATE()),
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
