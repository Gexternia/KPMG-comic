export const MODEL_NAME = 'gemini-2.5-flash-image';
export const TEXT_MODEL_NAME = 'gemini-2.5-flash';

// ──────────────────────────────────────────────
// SHARED STYLE BASE
// ──────────────────────────────────────────────
export const STYLE_PROMPT = `
STYLE RULES (apply to every image):
- American comic book style. Bold black ink outlines, halftone dot shading, dynamic angles.
- The character MUST closely resemble the person in the provided reference photo. Maintain the SAME face, hairstyle, body type, and outfit across ALL panels.
- Background: stylized corporate consulting environment (glass offices, city skyline, presentation screens).
- Color palette: deep blue (#00338D), medium blue (#005EB8), teal (#00A3A1), black, white. Use these as the ONLY dominant colors.
- Aspect Ratio: Landscape 4:3.
- Full bleed: artwork MUST extend to all four edges. NO white borders, NO panel frames, NO margins.

CRITICAL TEXT RULE:
- DO NOT render any text, letters, words, or typography inside the image.
- DO NOT draw speech bubbles, caption boxes, title banners, or any text containers.
- DO NOT include onomatopoeia, sound effects, signs with text, or screen text.
- The image must be PURELY visual artwork with ZERO text of any kind.
- Leave a clear visual area (lighter/simpler background) at the TOP or BOTTOM ~15% of the image where text will be overlaid digitally later. Do NOT put important character details in this area.
`;

// ──────────────────────────────────────────────
// CHARACTER CONSISTENCY ANCHOR
// ──────────────────────────────────────────────
export const CHARACTER_PROMPT = (userName: string) => `
CHARACTER IDENTITY:
- Name: ${userName}
- This character appears in EVERY panel. They must look like the SAME person throughout.
- Keep their clothing consistent: professional KPMG-style attire (dark blue suit or business casual).
- Their face, skin tone, hair, and build must match the reference photo in every image.
`;

// ──────────────────────────────────────────────
// STORY GENERATION (JSON)
// ──────────────────────────────────────────────
export const STORY_PROMPT = (data: { userName: string; worst: string; best: string }) => `
You are a comic book writer. Create a 4-panel narrative in SPANISH for a KPMG consultant named ${data.userName}.

Inputs:
- Protagonista: ${data.userName}
- Mayor aprendizaje en KPMG (reto, crecimiento): ${data.worst}
- Recuerdo más especial en KPMG (momento memorable): ${data.best}

Return ONLY a valid JSON object (no markdown, no backticks, no explanation). Keys:

{
  "p1_caption": "...",
  "p1_scene": "...",
  "p2_caption": "...",
  "p2_scene": "...",
  "p3_caption": "...",
  "p3_scene": "...",
  "p4_caption": "...",
  "p4_scene": "..."
}

Rules for each panel:
- "caption": Text that will appear as an overlay on the comic panel. MAX 6 words. Must be a dramatic, punchy line in Spanish. Use proper Spanish spelling and grammar.
- "scene": A short visual description (in English) of what is happening in the panel. MAX 20 words. Describe the action, body language, and atmosphere. Do NOT mention any text, speech bubbles, or captions — only visual action.

Tone: Fun, dramatic, professional. Think Marvel meets corporate consulting.

Panel structure:
- p1: THE DARK BEGINNING — The challenge arrives. Tie it to "${data.worst}".
- p2: THE STRUGGLE — Under pressure, doubt, exhaustion. Deepen the "${data.worst}" theme.
- p3: THE TURNING POINT — A ray of hope, a breakthrough moment.
- p4: THE GLORIOUS END — Victory and celebration. Tie it to "${data.best}".
`;

// ──────────────────────────────────────────────
// IMAGE PROMPTS
// ──────────────────────────────────────────────

// 1. COVER
export const COVER_PROMPT_TEMPLATE = (userName: string) => `
${STYLE_PROMPT}
${CHARACTER_PROMPT(userName)}

PAGE TYPE: Comic book cover.

ACTION: A heroic "Hero Shot" of ${userName}. Confident pose — arms crossed, looking directly at the viewer, or pointing forward. Dynamic perspective (slight low angle to make them look powerful).
The top ~20% of the image should have a darker or simpler background area (like a dark sky or gradient) where a title will be overlaid digitally. Do NOT put the character's head in this area.
The bottom ~10% should also be slightly simpler for a subtitle overlay.

Remember: absolutely NO text in the image.
`;

// 2. PANEL 1: Dark Start
export const P1_PROMPT_TEMPLATE = (userName: string, caption: string, scene: string) => `
${STYLE_PROMPT}
${CHARACTER_PROMPT(userName)}

PAGE TYPE: Comic panel 1 of 4.

ACTION: ${scene}
Atmosphere: Tense, serious, dramatic shadows.
Leave the top ~15% of the image with a simpler/darker background for a caption overlay. Keep the main action in the center and lower portions.

Remember: absolutely NO text in the image.
`;

// 3. PANEL 2: Struggle
export const P2_PROMPT_TEMPLATE = (userName: string, caption: string, scene: string, worst: string) => `
${STYLE_PROMPT}
${CHARACTER_PROMPT(userName)}

PAGE TYPE: Comic panel 2 of 4.

ACTION: ${scene}
Visual metaphor for this challenge: "${worst}".
Atmosphere: Dark, stressful, dramatic lighting with heavy shadows. Character looks exhausted or overwhelmed.
Leave the bottom ~15% of the image with a simpler background for a caption overlay.

Remember: absolutely NO text in the image.
`;

// 4. PANEL 3: Turning Point
export const P3_PROMPT_TEMPLATE = (userName: string, caption: string, scene: string) => `
${STYLE_PROMPT}
${CHARACTER_PROMPT(userName)}

PAGE TYPE: Comic panel 3 of 4.

ACTION: ${scene}
Atmosphere: Brighter colors emerging, determined expression, hopeful. Lighting shifts from dark to warm.
Leave the bottom ~15% of the image with a simpler background for a caption overlay.

Remember: absolutely NO text in the image.
`;

// 5. PANEL 4: Glorious End
export const P4_PROMPT_TEMPLATE = (userName: string, caption: string, scene: string, best: string) => `
${STYLE_PROMPT}
${CHARACTER_PROMPT(userName)}

PAGE TYPE: Comic panel 4 of 4.

ACTION: ${scene}
Visual metaphor for this special memory: "${best}".
Atmosphere: Bright, triumphant, epic. Full color saturation. Character is celebrating or standing victorious.
Leave the top ~15% of the image with a lighter/simpler area for an overlay.

Remember: absolutely NO text in the image.
`;

// 6. BACK COVER
export const BACK_COVER_PROMPT_TEMPLATE = (userName: string) => `
${STYLE_PROMPT}
${CHARACTER_PROMPT(userName)}

PAGE TYPE: Back cover.

ACTION: ${userName} walking confidently toward a bright horizon. Silhouette or semi-silhouette against a golden/teal sunset over a futuristic city skyline.
Atmosphere: Epic, peaceful, legendary. A sense of "the journey continues."
Leave the center-bottom area simpler for a "FIN" text overlay.

Remember: absolutely NO text in the image.
`;