import { UserData, ComicPages } from '../types';

/**
 * Detects and crops letterbox/white borders baked into an AI-generated image.
 * Scans edge pixels; if significant white borders found, crops them out.
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
 * Generate comic book (Images + Text)
 */
export async function generateComicBook(userData: UserData): Promise<ComicPages> {
  if (!userData.photo) throw new Error("Falta la foto del usuario");

  const response = await fetch('/api/comic-generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.message === 'string'
      ? body.message
      : 'Error desconocido al generar cómic.';
    throw new Error(message);
  }

  const comic = body as ComicPages;

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
