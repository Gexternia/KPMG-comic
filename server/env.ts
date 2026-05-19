/**
 * Lee variables de entorno en runtime (notación dinámica para que Vite
 * no las sustituya por undefined al empaquetar el middleware del servidor).
 */
export function envString(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function envNumber(key: string, fallback: number): number {
  const raw = envString(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
