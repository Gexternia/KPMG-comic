import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

// Credenciales del panel. Por defecto las pedidas para el evento; se pueden sobrescribir
// por entorno (ADMIN_EMAIL / ADMIN_PASSWORD) en Render sin tocar el código.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@admin.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS) || 8 * 60 * 60 * 1000;

// Tokens de sesión en memoria. Se pierden al reiniciar (hay que volver a entrar); suficiente
// para un panel de solo lectura durante un evento.
const sessions = new Map<string, number>();

function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function verifyAdminCredentials(email: unknown, password: unknown): boolean {
  if (typeof email !== "string" || typeof password !== "string") return false;
  const emailOk = safeEqual(email.trim().toLowerCase(), ADMIN_EMAIL);
  const passwordOk = safeEqual(password, ADMIN_PASSWORD);
  return emailOk && passwordOk;
}

export function createAdminSession(): { token: string; expiresInMs: number } {
  const token = `${randomUUID()}${randomUUID().replace(/-/g, "")}`;
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return { token, expiresInMs: SESSION_TTL_MS };
}

export function isAdminTokenValid(authorizationHeader: string | undefined): boolean {
  if (!authorizationHeader) return false;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1].trim();
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}
