interface MetricPoint {
  durationMs: number;
  ts: number;
}

interface RouteMetrics {
  requestsTotal: number;
  statusCounts: Map<number, number>;
  durations: MetricPoint[];
}

const MAX_SAMPLES_PER_ROUTE = 2000;
const MAX_COMIC_SAMPLES = 2000;
const MAX_RECENT_COMIC_EVENTS = 50;
const routeStore = new Map<string, RouteMetrics>();
const aiCallCounts = new Map<string, number>();
// Agregado estructurado (kind -> outcome -> count) para el panel de administración.
const aiByKindOutcome = new Map<string, Map<string, number>>();
let panelCacheHits = 0;

interface ComicEvent {
  ts: number;
  outcome: "success" | "failure";
  code?: string;
  durationMs: number;
  requestId?: string;
}

let comicStarted = 0;
let comicSucceeded = 0;
let comicFailed = 0;
const comicFailuresByCode = new Map<string, number>();
const comicDurations: number[] = [];
const recentComicEvents: ComicEvent[] = [];

function getRouteKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function getRouteMetrics(method: string, path: string): RouteMetrics {
  const key = getRouteKey(method, path);
  const current = routeStore.get(key);
  if (current) return current;

  const created: RouteMetrics = {
    requestsTotal: 0,
    statusCounts: new Map<number, number>(),
    durations: [],
  };
  routeStore.set(key, created);
  return created;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

export function recordHttpMetric(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  const route = getRouteMetrics(method, path);
  route.requestsTotal += 1;
  route.statusCounts.set(statusCode, (route.statusCounts.get(statusCode) || 0) + 1);
  route.durations.push({ durationMs, ts: Date.now() });

  if (route.durations.length > MAX_SAMPLES_PER_ROUTE) {
    route.durations.splice(0, route.durations.length - MAX_SAMPLES_PER_ROUTE);
  }
}

export function recordAiCall(kind: "image" | "text", keyIndex: number, outcome: string): void {
  const key = `kind="${kind}",key="${keyIndex}",outcome="${outcome}"`;
  aiCallCounts.set(key, (aiCallCounts.get(key) || 0) + 1);

  const byOutcome = aiByKindOutcome.get(kind) ?? new Map<string, number>();
  byOutcome.set(outcome, (byOutcome.get(outcome) || 0) + 1);
  aiByKindOutcome.set(kind, byOutcome);
}

export function recordPanelCacheHit(): void {
  panelCacheHits += 1;
}

export function recordComicStarted(): void {
  comicStarted += 1;
}

export function recordComicOutcome(
  outcome: "success" | "failure",
  durationMs: number,
  requestId?: string,
  code?: string
): void {
  if (outcome === "success") {
    comicSucceeded += 1;
  } else {
    comicFailed += 1;
    const key = code || "unknown";
    comicFailuresByCode.set(key, (comicFailuresByCode.get(key) || 0) + 1);
  }

  comicDurations.push(durationMs);
  if (comicDurations.length > MAX_COMIC_SAMPLES) {
    comicDurations.splice(0, comicDurations.length - MAX_COMIC_SAMPLES);
  }

  recentComicEvents.unshift({ ts: Date.now(), outcome, code, durationMs, requestId });
  if (recentComicEvents.length > MAX_RECENT_COMIC_EVENTS) {
    recentComicEvents.length = MAX_RECENT_COMIC_EVENTS;
  }
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildAiSummary(): Record<string, { total: number; ok: number; failed: number; byOutcome: Record<string, number> }> {
  const summary: Record<string, { total: number; ok: number; failed: number; byOutcome: Record<string, number> }> = {};
  for (const [kind, byOutcome] of aiByKindOutcome.entries()) {
    let total = 0;
    let ok = 0;
    const outcomes: Record<string, number> = {};
    for (const [outcome, count] of byOutcome.entries()) {
      total += count;
      if (outcome === "ok") ok += count;
      outcomes[outcome] = count;
    }
    summary[kind] = { total, ok, failed: total - ok, byOutcome: outcomes };
  }
  return summary;
}

/** Resumen de negocio pensado para el panel /admin (no para Prometheus). */
export function buildAdminStats(): Record<string, unknown> {
  const active = Math.max(0, comicStarted - comicSucceeded - comicFailed);
  const finished = comicSucceeded + comicFailed;
  const successRate = finished > 0 ? (comicSucceeded / finished) * 100 : 0;

  return {
    generatedAt: new Date().toISOString(),
    comics: {
      started: comicStarted,
      succeeded: comicSucceeded,
      failed: comicFailed,
      active,
      successRate: Number(successRate.toFixed(1)),
      avgDurationMs: Math.round(average(comicDurations)),
      p95DurationMs: Math.round(percentile(comicDurations, 95)),
      failuresByCode: Object.fromEntries(comicFailuresByCode),
    },
    ai: buildAiSummary(),
    cache: { panelHits: panelCacheHits },
    recent: recentComicEvents.slice(0, 20).map((event) => ({
      ts: new Date(event.ts).toISOString(),
      outcome: event.outcome,
      code: event.code ?? null,
      durationMs: event.durationMs,
      requestId: event.requestId ?? null,
    })),
  };
}

export function buildHealthJson(): Record<string, unknown> {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
}

export function buildPrometheusMetrics(): string {
  const lines: string[] = [];
  lines.push("# HELP app_http_requests_total Total de requests HTTP por endpoint.");
  lines.push("# TYPE app_http_requests_total counter");
  lines.push("# HELP app_http_requests_by_status_total Requests HTTP por endpoint y status.");
  lines.push("# TYPE app_http_requests_by_status_total counter");
  lines.push("# HELP app_http_request_duration_ms_p95 Latencia p95 (ms) por endpoint.");
  lines.push("# TYPE app_http_request_duration_ms_p95 gauge");

  for (const [routeKey, data] of routeStore.entries()) {
    const [method, ...pathParts] = routeKey.split(" ");
    const path = pathParts.join(" ");
    const durations = data.durations.map((item) => item.durationMs);
    const p95 = percentile(durations, 95);

    lines.push(
      `app_http_requests_total{method="${method}",path="${path}"} ${data.requestsTotal}`
    );
    lines.push(
      `app_http_request_duration_ms_p95{method="${method}",path="${path}"} ${p95.toFixed(2)}`
    );

    for (const [status, count] of data.statusCounts.entries()) {
      lines.push(
        `app_http_requests_by_status_total{method="${method}",path="${path}",status="${status}"} ${count}`
      );
    }
  }

  lines.push("# HELP app_ai_calls_total Llamadas a Gemini por tipo, clave y resultado.");
  lines.push("# TYPE app_ai_calls_total counter");
  for (const [labels, count] of aiCallCounts.entries()) {
    lines.push(`app_ai_calls_total{${labels}} ${count}`);
  }

  lines.push("# HELP app_panel_cache_hits_total Viñetas reutilizadas sin volver a pagarlas.");
  lines.push("# TYPE app_panel_cache_hits_total counter");
  lines.push(`app_panel_cache_hits_total ${panelCacheHits}`);

  return `${lines.join("\n")}\n`;
}
