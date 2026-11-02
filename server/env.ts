import { loadEnv } from "vite";

// Los módulos de server/ leen su configuración al importarse, antes de que se ejecute
// defineConfig en vite.config.ts. Cargar .env aquí evita que esos valores se ignoren.
// Las variables reales del entorno (Render) tienen prioridad sobre el archivo.
Object.assign(process.env, loadEnv("", process.cwd(), ""));

export function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
