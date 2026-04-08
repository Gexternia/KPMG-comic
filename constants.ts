export const MODEL_NAME = 'gemini-2.5-flash-image';
export const TEXT_MODEL_NAME = 'gemini-2.5-flash';

// Prompt templates
export const STYLE_PROMPT = `
Style: American comic book style, modern, high contrast, bold black ink lines, halftone patterns.
The character MUST closely resemble the person in the provided image.
Background: stylized corporate consulting environment (glass offices, city skyline, presentation screens).
Dominant colors: deep blues (#00338D), medium blues (#005EB8) and teal (#00A3A1) with classic comic black and white.
Aspect Ratio: Landscape 4:3. Edge-to-edge artwork (full bleed).
IMPORTANT: The artwork MUST bleed fully to all four edges. DO NOT include white borders, comic panel frames, letterboxing, or margins around the image.
Any text appearing in the image (signs, screens, titles) MUST be in Spanish.
`;

// Story Generation (JSON)
export const STORY_PROMPT = (data: {userName: string, worst: string, best: string}) => `
You are a comic book writer. Write a short, punchy, dramatic narrative in SPANISH for a 4-panel comic about a consultant from KPMG named ${data.userName}.
Inputs:
- Protagonist: ${data.userName}
- Mayor aprendizaje en KPMG (reto, crecimiento): ${data.worst}
- Recuerdo más especial en KPMG (momento memorable): ${data.best}

Return strictly a JSON object with these 4 keys containing the text for a caption box or speech bubble:
- "p1": The Dark Beginning (The challenge arrives)
- "p2": The struggle tied to that learning experience (pressure, doubt)
- "p3": The Turning Point (A ray of hope)
- "p4": The Glorious End (echoing their special memory / success)
Keep texts short (max 15 words). Fun, dramatic, and professional KPMG tone.
`;

// 1. Cover
export const COVER_PROMPT_TEMPLATE = (userName: string) => `
${STYLE_PROMPT}
Context: A comic book cover.
Action: A heroic "Hero Shot" of the character looking confident and strong, maybe arms crossed or pointing forward.
Text: The image MUST include a bold, stylish comic book title at the top center. To ensure it fits perfectly and does not get cropped horizontally, the title MUST be split into two lines:
Line 1: "${userName.toUpperCase()} EN" (Make this line exceptionally LARGE, 25% larger than line 2)
Line 2: "KPMG" (Make this line 25% smaller than line 1)
Keep the text perfectly centered and leave wide clear margins on the left and right edges.
IMPORTANT: DO NOT include any white borders, frames, or margins around the image. The artwork MUST bleed fully to the edges.
`;

// 2. Page 1: Dark Start
export const P1_PROMPT_TEMPLATE = () => `
${STYLE_PROMPT}
Context: The challenge arrives.
Action: The character faces a difficult situation or the start of a major problem.
Atmosphere: Tense, serious.
`;

// 3. Page 2: Challenge / learning under pressure
export const P2_PROMPT_TEMPLATE = (worst: string) => `
${STYLE_PROMPT}
Context: The hardest part of that learning experience.
Action: The character is struggling, exhausted, or under intense pressure. Visual metaphor for this learning moment: "${worst}".
Atmosphere: Dark, stressful, dramatic lighting.
`;

// 4. Page 3: Turning Point
export const P3_PROMPT_TEMPLATE = () => `
${STYLE_PROMPT}
Context: The turning point.
Action: The character finds a solution, a ray of hope, or starts to overcome the obstacle.
Atmosphere: Brighter, determined, hopeful.
`;

// 5. Page 4: Glorious End
export const P4_PROMPT_TEMPLATE = (best: string) => `
${STYLE_PROMPT}
Context: The glorious end.
Action: The character celebrates a victory or cherished memory. Visual metaphor for this special moment: "${best}".
Atmosphere: Bright, triumphant, epic.
`;

// 8. Back Cover
export const BACK_COVER_PROMPT_TEMPLATE = () => `
${STYLE_PROMPT}
Context: The End / Legacy.
Action: The character walking into a bright sunset or standing on a mountain top looking at a futuristic city.
Atmosphere: Epic, peaceful, legendary.
`;
