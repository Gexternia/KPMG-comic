import { UserData, ComicPages } from '../types';

// Algo más que COMIC_DEADLINE_MS del servidor, para que normalmente responda él con el motivo real.
const COMIC_REQUEST_TIMEOUT_MS = 285_000;

// Solo se recorta lo que es claramente un marco: una banda clara u oscura casi sin variación.
// Medido con viñetas reales de Gemini: sus marcos varían 4 como máximo; el dibujo, 9 o más.
const BORDER_LIGHT_MIN = 180;
const BORDER_DARK_MAX = 40;
const BORDER_MAX_DEVIATION = 6;
const MAX_BORDER_RATIO = 0.2;

interface ComicApiErrorBody {
  message?: unknown;
  requestId?: unknown;
  code?: unknown;
}

export class ComicGenerationError extends Error {
  status?: number;
  code?: string;
  requestId?: string;

  constructor(message: string, options: { status?: number; code?: string; requestId?: string } = {}) {
    super(message);
    this.name = 'ComicGenerationError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getStringField(source: ComicApiErrorBody | null, key: keyof ComicApiErrorBody): string | undefined {
  const value = source?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isComicPages(value: unknown): value is ComicPages {
  if (!isRecord(value)) return false;

  const captions = value.captions;
  return (
    ['cover', 'p1', 'p2', 'p3', 'p4', 'backCover'].every((key) => {
      const image = value[key];
      return typeof image === 'string' || image === null;
    }) &&
    isRecord(captions) &&
    ['p1', 'p2', 'p3', 'p4'].every((key) => typeof captions[key] === 'string')
  );
}

/**
 * Detects and crops letterbox/white borders baked into an AI-generated image.
 * Scans edge pixels; uniform light or dark bands are cropped out. Wider bands are
 * treated as artwork (a white sky, a dark floor) so the character stays centered.
 * Returns a clean data URL (original untouched if no borders detected).
 */
async function cropWhiteBorders(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null;
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

      const lineIsBorder = (length: number, pixelAt: (i: number) => number): boolean => {
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < length; i++) {
          const idx = pixelAt(i) * 4;
          r += imageData[idx]; g += imageData[idx + 1]; b += imageData[idx + 2];
        }
        r /= length; g /= length; b /= length;

        const isLight = r > BORDER_LIGHT_MIN && g > BORDER_LIGHT_MIN && b > BORDER_LIGHT_MIN;
        const isDark = r < BORDER_DARK_MAX && g < BORDER_DARK_MAX && b < BORDER_DARK_MAX;
        if (!isLight && !isDark) return false;

        let deviation = 0;
        for (let i = 0; i < length; i++) {
          const idx = pixelAt(i) * 4;
          deviation += Math.abs(imageData[idx] - r) + Math.abs(imageData[idx + 1] - g) + Math.abs(imageData[idx + 2] - b);
        }
        return deviation / (length * 3) <= BORDER_MAX_DEVIATION;
      };

      const rowIsBorder = (y: number): boolean => lineIsBorder(width, (x) => y * width + x);
      const colIsBorder = (x: number): boolean => lineIsBorder(height, (y) => y * width + x);

      const measureBand = (size: number, isBorder: (offset: number) => boolean): number => {
        const limit = Math.floor(size * MAX_BORDER_RATIO);
        let band = 0;
        while (band < limit && isBorder(band)) band++;
        return band >= limit ? 0 : band;
      };

      const top = measureBand(height, rowIsBorder);
      const bottom = measureBand(height, (offset) => rowIsBorder(height - 1 - offset));
      const left = measureBand(width, colIsBorder);
      const right = measureBand(width, (offset) => colIsBorder(width - 1 - offset));

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
 * Generate comic book (Images + Text)
 */
export async function generateComicBook(userData: UserData): Promise<ComicPages> {
  if (!userData.photo) throw new ComicGenerationError("Falta la foto del usuario");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMIC_REQUEST_TIMEOUT_MS);

  let response: Response;
  let body: unknown;
  try {
    response = await fetch('/api/comic-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData),
      signal: controller.signal
    });
    body = await response.json().catch(() => {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return null;
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ComicGenerationError(
        'La generación está tardando demasiado. Intenta de nuevo: lo ya dibujado no se pierde.',
        { code: 'client_timeout' }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorBody = isRecord(body) ? body : null;
    const message = getStringField(errorBody, 'message')
      || `Error del servidor (${response.status}). Intenta nuevamente.`;
    throw new ComicGenerationError(message, {
      status: response.status,
      code: getStringField(errorBody, 'code'),
      requestId: getStringField(errorBody, 'requestId'),
    });
  }

  if (!isComicPages(body)) {
    throw new ComicGenerationError(
      'El servidor devolvió una respuesta inválida. Intenta nuevamente.',
      { status: response.status }
    );
  }

  const comic = body;

  const [cover, p1, p2, p3, p4, backCover] = await Promise.all([
    cropWhiteBorders(comic.cover),
    cropWhiteBorders(comic.p1),
    cropWhiteBorders(comic.p2),
    cropWhiteBorders(comic.p3),
    cropWhiteBorders(comic.p4),
    cropWhiteBorders(comic.backCover)
  ]);

  return { ...comic, cover, p1, p2, p3, p4, backCover };
}
