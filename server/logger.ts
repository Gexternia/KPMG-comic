import { mkdir, appendFile, stat, rename } from "node:fs/promises";
import path from "node:path";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
}

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "usage.log");
const LOG_TO_CONSOLE = (process.env.LOG_TO_CONSOLE || "true").toLowerCase() !== "false";
const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
const LOG_MAX_SIZE_BYTES = Number(process.env.LOG_MAX_SIZE_BYTES || 5 * 1024 * 1024);
const LOG_ROTATE_DAILY = (process.env.LOG_ROTATE_DAILY || "true").toLowerCase() !== "false";

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let lastRotationDay = "";

function shouldLog(level: LogLevel): boolean {
  const currentThreshold = LOG_LEVEL_WEIGHT[LOG_LEVEL] ?? LOG_LEVEL_WEIGHT.info;
  return LOG_LEVEL_WEIGHT[level] >= currentThreshold;
}

function toConsole(entry: LogEntry): void {
  if (!LOG_TO_CONSOLE) return;
  if (!shouldLog(entry.level)) return;

  const line = JSON.stringify(entry);
  if (entry.level === "error") return console.error(line);
  console.log(line);
}

function getDayTag(dateIso: string): string {
  return dateIso.slice(0, 10);
}

async function rotateByDayIfNeeded(dayTag: string): Promise<void> {
  if (!LOG_ROTATE_DAILY) return;
  if (!lastRotationDay) {
    lastRotationDay = dayTag;
    return;
  }
  if (dayTag === lastRotationDay) return;

  try {
    const rotatedName = path.join(LOG_DIR, `usage-${lastRotationDay}.log`);
    await rename(LOG_FILE, rotatedName);
  } catch {
    // Si no existe el archivo aún, no es error operativo.
  } finally {
    lastRotationDay = dayTag;
  }
}

async function rotateBySizeIfNeeded(dayTag: string): Promise<void> {
  try {
    const fileInfo = await stat(LOG_FILE);
    if (fileInfo.size < LOG_MAX_SIZE_BYTES) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedName = path.join(LOG_DIR, `usage-${dayTag}-${stamp}.log`);
    await rename(LOG_FILE, rotatedName);
  } catch {
    // Si no existe archivo o no se puede leer tamaño, seguimos sin bloquear.
  }
}

async function write(entry: LogEntry): Promise<void> {
  if (!shouldLog(entry.level)) return;
  toConsole(entry);
  try {
    await mkdir(LOG_DIR, { recursive: true });
    const dayTag = getDayTag(entry.ts);
    await rotateByDayIfNeeded(dayTag);
    await rotateBySizeIfNeeded(dayTag);
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    const fallback = error instanceof Error ? error.message : String(error);
    console.error(`[logger] No se pudo escribir en ${LOG_FILE}: ${fallback}`);
  }
}

export async function logDebug(
  event: string,
  requestId: string,
  meta?: Record<string, unknown>,
  durationMs?: number
): Promise<void> {
  await write({
    ts: new Date().toISOString(),
    level: "debug",
    event,
    requestId,
    durationMs,
    meta,
  });
}

export async function logInfo(
  event: string,
  requestId: string,
  meta?: Record<string, unknown>,
  durationMs?: number
): Promise<void> {
  await write({
    ts: new Date().toISOString(),
    level: "info",
    event,
    requestId,
    durationMs,
    meta,
  });
}

export async function logWarn(
  event: string,
  requestId: string,
  meta?: Record<string, unknown>,
  durationMs?: number
): Promise<void> {
  await write({
    ts: new Date().toISOString(),
    level: "warn",
    event,
    requestId,
    durationMs,
    meta,
  });
}

export async function logError(
  event: string,
  requestId: string,
  error: unknown,
  meta?: Record<string, unknown>,
  durationMs?: number
): Promise<void> {
  const errorInfo =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };

  await write({
    ts: new Date().toISOString(),
    level: "error",
    event,
    requestId,
    durationMs,
    meta: { ...meta, error: errorInfo },
  });
}
