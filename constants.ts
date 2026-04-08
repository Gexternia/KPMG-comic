export const MODEL_NAME = 'gemini-2.5-flash-image';
export const TEXT_MODEL_NAME = 'gemini-2.5-flash';

// ──────────────────────────────────────────────
// SHARED STYLE BASE
// ──────────────────────────────────────────────
export const STYLE_PROMPT = `
Style: American comic book style, modern, high contrast, bold black ink lines, halftone patterns.
The character MUST closely resemble the person in the provided image.
Background: stylized corporate consulting environment (glass offices, city skyline, presentation screens).
Dominant colors: deep blues (#00338D), medium blues (#005EB8) and teal (#00A3A1) with classic comic black and white.
Aspect Ratio: Vertical Portrait 3:4.
Framing: A single, edge-to-edge full-bleed illustration. The scene MUST stretch to the very edges of the canvas without interruption.
IMPORTANT NO BORDERS: You must draw the illustration filling the entire picture. Absolutely NO white margins, NO black borders, NO letterboxing, and NO comic panel subdivisions.
`;

export const NO_TEXT_PROMPT = `
CRITICAL NO TEXT: DO NOT draw ANY text, speech bubbles, captions, signs, floating letters, or holographic screens with text. The artwork MUST be 100% textless. ZERO letters or words.
`;

export const COVER_TEXT_RULES = `
SAFE ZONE FOR TEXT: The left and right edges (at least 20% on each side) will be CROPPED during printing. Therefore, ALL text, signs, screens, and the main focal points MUST be placed strictly in the CENTER of the image.
CRITICAL SPELLING: Any text MUST be perfect Spanish, checked letter-by-letter.
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
${COVER_TEXT_RULES}
Context: A comic book cover.
Action: A heroic "Hero Shot" of the character looking confident and strong, maybe arms crossed or pointing forward.
Text: The image MUST include a bold, stylish comic book title at the top center. To ensure it fits perfectly and does not get cropped horizontally, the title MUST be split into two lines:
Line 1: "${userName.toUpperCase()} EN" (Make this line exceptionally LARGE, 25% larger than line 2)
Line 2: "KPMG" (Make this line 25% smaller than line 1)
Keep the text perfectly centered and leave wide clear margins on the left and right edges.
IMPORTANT: DO NOT include any white borders, frames, or margins around the image. The artwork MUST bleed fully to the edges.
`;

// 2. PANEL 1: Dark Start
export const P1_PROMPT_TEMPLATE = (userName: string, caption: string, scene: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Context: The challenge arrives.
Action: The character faces a difficult situation or the start of a major problem.
Atmosphere: Tense, serious.
`;

// 3. PANEL 2: Struggle
export const P2_PROMPT_TEMPLATE = (userName: string, caption: string, scene: string, worst: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Context: The hardest part of that learning experience.
Action: The character is struggling, exhausted, or under intense pressure. Visual metaphor for this learning moment: "${worst}".
Atmosphere: Dark, stressful, dramatic lighting.
`;

// 4. PANEL 3: Turning Point
export const P3_PROMPT_TEMPLATE = (userName: string, caption: string, scene: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Context: The turning point.
Action: The character finds a solution, a ray of hope, or starts to overcome the obstacle.
Atmosphere: Brighter, determined, hopeful.
`;

// 5. PANEL 4: Glorious End
export const P4_PROMPT_TEMPLATE = (userName: string, caption: string, scene: string, best: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Context: The glorious end.
Action: The character celebrates a victory or cherished memory. Visual metaphor for this special moment: "${best}".
Atmosphere: Bright, triumphant, epic.
`;

// 6. BACK COVER
export const BACK_COVER_PROMPT_TEMPLATE = (userName: string) => `
${STYLE_PROMPT}
${NO_TEXT_PROMPT}
Context: The End / Legacy.
Action: The character walking into a bright sunset or standing on a mountain top looking at a futuristic city.
Atmosphere: Epic, peaceful, legendary.
`;
