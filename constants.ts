export const MODEL_NAME = 'gemini-2.5-flash-image';
export const TEXT_MODEL_NAME = 'gemini-2.5-flash';

// Prompt templates
export const STYLE_PROMPT = `
Style: American comic book style, modern, high contrast, bold black ink lines, halftone patterns.
The character MUST closely resemble the person in the provided image.
Background: stylized corporate consulting environment (glass offices, city skyline, presentation screens).
Dominant colors: deep blues (#00338D), medium blues (#005EB8) and teal (#00A3A1) with classic comic black and white.
FILL THE ENTIRE CANVAS: The artwork must bleed fully to every edge — no white margins, no letterboxing, no inner panel frames, no borders of any kind. Every pixel must be part of the scene.
`;

export const NO_TEXT_PROMPT = `
CRITICAL NO TEXT: DO NOT draw ANY text, speech bubbles, captions, signs, floating letters, or holographic screens with text. The artwork MUST be 100% textless. ZERO letters or words.
`;

export const COVER_TEXT_RULES = `
SAFE ZONE FOR TEXT: The left and right edges (at least 20% on each side) will be CROPPED during printing. Therefore, ALL text, signs, screens, and the main focal points MUST be placed strictly in the CENTER of the image.
CRITICAL SPELLING: Any text MUST be perfect Spanish, checked letter-by-letter.
`;

// Story Generation (JSON)
export const STORY_PROMPT = (data: { userName: string; worst: string; best: string }) => `
You are a comic book writer. Write short caption lines in SPANISH for a 4-panel comic about a KPMG consultant named ${data.userName}.

The user wrote (use their meaning and tone; do not invent facts they did not imply):
- Texto sobre su mayor aprendizaje / reto en KPMG: ${data.worst}
- Texto sobre su recuerdo más especial en KPMG: ${data.best}

Interpret those texts naturally. Do not force a dramatic arc, suffering, or a "hero's journey" unless their words suggest it. If they sound lighthearted, keep it light; if reflective, stay reflective. Four sequential beats (p1 → p4) that fit what they said.

Return strictly a JSON object with these keys (caption or speech bubble text each):
- "p1": First panel — sets the scene or first idea tied to their inputs.
- "p2": Second panel — continues from their learning/challenge text as they framed it.
- "p3": Third panel — bridge or development between both ideas, only as implied by their words.
- "p4": Fourth panel — closes with their special memory / how they described it.

Keep each value short (max 15 words). Professional KPMG context is fine; match the user's emotional tone.
`;

// 1. Cover
export const COVER_PROMPT_TEMPLATE = (userName: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Context: A comic book cover.
Action: A heroic "Hero Shot" of the character looking confident and strong, maybe arms crossed or pointing forward.
`;

// 2. Page 1 — interpret user's story opening from both texts
export const P1_PROMPT_TEMPLATE = (worst: string, best: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
The user described these (Spanish). Illustrate the FIRST panel of their comic — a scene that naturally starts their story as you interpret it from both lines. Do not force conflict, darkness, or stress unless their words suggest it.
Learning/challenge: "${worst}"
Special memory: "${best}"
`;

// 3. Page 2 — learning / challenge as the user framed it
export const P2_PROMPT_TEMPLATE = (worst: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Illustrate a scene that reflects what the user wrote below. Interpret their meaning and mood; use a fitting visual metaphor if helpful. Avoid defaulting to suffering, exhaustion, or doom unless they clearly said so.
User text: "${worst}"
`;

// 4. Page 3 — bridge between both ideas, tone from the user
export const P3_PROMPT_TEMPLATE = (worst: string, best: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Illustrate a middle moment that connects these two ideas in a way that fits what the user actually wrote. No required "turning point" or hope arc — only what their words support.
Learning/challenge: "${worst}"
Special memory: "${best}"
`;

// 5. Page 4 — special memory as the user framed it
export const P4_PROMPT_TEMPLATE = (best: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Illustrate a scene that reflects what the user wrote below. Match their tone (celebratory, quiet, funny, nostalgic, etc.). Do not force a triumphant or epic finale unless it fits their words.
User text: "${best}"
`;

// 8. Back Cover
export const BACK_COVER_PROMPT_TEMPLATE = () => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Context: The End / Legacy.
Action: The character standing tall and centered in the frame, facing the viewer heroically, with a dramatic epic city skyline and glowing light behind them.
Atmosphere: Epic, powerful, legendary.
`;
