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
const routeStore = new Map<string, RouteMetrics>();
const startedAt = Date.now();

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

export function buildHealthJson(): Record<string, unknown> {
  return {
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    endpointsTracked: routeStore.size,
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

  return `${lines.join("\n")}\n`;
}
