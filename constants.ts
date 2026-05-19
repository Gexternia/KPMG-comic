export const TEXT_MODEL_NAME = 'gemini-2.5-flash';

export const STYLE_SUFFIX = `american comic book panel style, bold black ink outlines, halftone shading, KPMG corporate colors (deep blue, electric blue, teal accents), dynamic comic composition, vibrant flat colors, full bleed illustration edge to edge`;

export const GLOBAL_NEGATIVE_PROMPT = `text, words, letters, captions, speech bubbles, logos, signs, signage, written content, watermarks, multiple faces, deformed face, distorted features, ugly, blurry, low quality, low resolution, photograph, photorealistic, 3d render, cartoon for kids, anime, manga, chibi, nsfw`;

export const COVER_DIMENSIONS = { width: 768, height: 1024 };
export const PANEL_DIMENSIONS = { width: 1024, height: 1024 };
export const BACK_COVER_DIMENSIONS = { width: 768, height: 1024 };

/** PhotoMaker trigger; Kontext/FLUX ignoran esto y usan la foto en input_image */
export const TRIGGER_SUBJECT = "person img";

const IDENTITY = `The person in the provided photograph is the KPMG consultant protagonist and must closely resemble that face: same face shape, eyes, nose, lips, jawline, hairstyle, hair color, and skin tone.`;

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

export const COVER_PROMPT_TEMPLATE = (_userName: string) =>
  `${IDENTITY} ${TRIGGER_SUBJECT}, confident KPMG consultant in business attire, arms crossed heroic pose, modern glass office with city skyline, dramatic lighting, three-quarter angle, ${STYLE_SUFFIX}`;

export const P1_PROMPT_TEMPLATE = (_worst: string, _best: string) =>
  `${IDENTITY} ${TRIGGER_SUBJECT}, KPMG consultant in modern corporate office, desk with monitors showing abstract data charts, glass walls and colleagues in background, wide medium shot showing full environment, focused expression, ${STYLE_SUFFIX}`;

export const P2_PROMPT_TEMPLATE = (_worst: string) =>
  `${IDENTITY} ${TRIGGER_SUBJECT}, KPMG consultant presenting abstract data visualizations on large screen to colleagues around glass conference table, gesturing with confidence, wide medium shot showing room and team, ${STYLE_SUFFIX}`;

export const P3_PROMPT_TEMPLATE = (_worst: string, _best: string) =>
  `${IDENTITY} ${TRIGGER_SUBJECT}, KPMG consultant collaborating with colleagues at standing meeting, tablet with geometric dashboard shapes, glass walls and city view, wide medium shot, ${STYLE_SUFFIX}`;

export const P4_PROMPT_TEMPLATE = (_best: string) =>
  `${IDENTITY} ${TRIGGER_SUBJECT}, KPMG consultant celebrating professional achievement in front of glass windows with sunset skyline, satisfied confident expression, warm rim lighting, wide medium shot, ${STYLE_SUFFIX}`;

export const BACK_COVER_PROMPT_TEMPLATE = () =>
  `${IDENTITY} ${TRIGGER_SUBJECT}, consultant standing tall facing viewer in heroic pose, golden hour city skyline and corporate towers behind, warm rim light, cinematic epic composition, ${STYLE_SUFFIX}`;
