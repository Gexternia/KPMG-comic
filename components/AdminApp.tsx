import React, { useCallback, useEffect, useState } from 'react';
import { Button } from './Button';
import { Loader2, LogOut, RefreshCcw, Lock, Activity, CheckCircle2, XCircle, Clock, Download } from 'lucide-react';

const TOKEN_STORAGE_KEY = 'kpmg_admin_token';
const POLL_INTERVAL_MS = 5000;

interface AiSummary {
  total: number;
  ok: number;
  failed: number;
  byOutcome: Record<string, number>;
}

interface RecentEvent {
  ts: string;
  outcome: 'success' | 'failure';
  code: string | null;
  durationMs: number;
  requestId: string | null;
}

interface AdminStats {
  generatedAt: string;
  comics: {
    started: number;
    succeeded: number;
    failed: number;
    active: number;
    successRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
    failuresByCode: Record<string, number>;
  };
  ai: Record<string, AiSummary>;
  cache: { panelHits: number };
  recent: RecentEvent[];
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-ES');
  } catch {
    return iso;
  }
}

/** Escapa un valor para CSV (comillas, comas y saltos de línea). */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

/** Construye un CSV con varias secciones a partir de las estadísticas actuales. */
function buildCsv(stats: AdminStats): string {
  const { comics, ai, cache, recent } = stats;
  const lines: string[] = [];

  lines.push(csvRow(['Resumen', 'Valor']));
  lines.push(csvRow(['Generado', stats.generatedAt]));
  lines.push(csvRow(['Cómics creados', comics.succeeded]));
  lines.push(csvRow(['Fallidos', comics.failed]));
  lines.push(csvRow(['En curso', comics.active]));
  lines.push(csvRow(['Intentos totales', comics.started]));
  lines.push(csvRow(['Tasa de éxito (%)', comics.successRate]));
  lines.push(csvRow(['Duración media (ms)', comics.avgDurationMs]));
  lines.push(csvRow(['Duración p95 (ms)', comics.p95DurationMs]));
  lines.push(csvRow(['Viñetas reusadas', cache.panelHits]));

  lines.push('');
  lines.push(csvRow(['Fallos por tipo', 'Cantidad']));
  const failureEntries = Object.entries(comics.failuresByCode) as [string, number][];
  if (failureEntries.length === 0) lines.push(csvRow(['(sin fallos)', 0]));
  else failureEntries.sort((a, b) => b[1] - a[1]).forEach(([code, count]) => lines.push(csvRow([code, count])));

  lines.push('');
  lines.push(csvRow(['IA', 'Total', 'OK', 'Fallos']));
  (Object.entries(ai) as [string, AiSummary][]).forEach(([kind, summary]) =>
    lines.push(csvRow([kind, summary.total, summary.ok, summary.failed]))
  );

  lines.push('');
  lines.push(csvRow(['Hora', 'Resultado', 'Motivo', 'Duración (ms)', 'RequestId']));
  recent.forEach((event) =>
    lines.push(csvRow([event.ts, event.outcome, event.code ?? '', event.durationMs, event.requestId ?? '']))
  );

  return lines.join('\r\n');
}

function downloadStatsCsv(stats: AdminStats): void {
  // BOM para que Excel reconozca UTF-8 (acentos) correctamente.
  const blob = new Blob(['\uFEFF', buildCsv(stats)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.download = `kpmg-comic-stats-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  accent: string;
  icon: React.ReactNode;
}> = ({ label, value, accent, icon }) => (
  <div className={`border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${accent}`}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</span>
      {icon}
    </div>
    <div className="mt-2 text-4xl font-black leading-none">{value}</div>
  </div>
);

const LoginForm: React.FC<{ onSuccess: (token: string) => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.token) {
        setError(body?.message || 'No se pudo iniciar sesión.');
        return;
      }
      onSuccess(body.token as string);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 border-4 border-black bg-white p-6 text-[#00338D] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-6 w-6" />
          <h1 className="text-2xl font-black uppercase">Panel KPMG</h1>
        </div>
        <p className="text-sm font-semibold text-gray-600">Acceso de monitorización del evento.</p>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className="w-full border-4 border-black p-3 font-semibold outline-none focus:bg-yellow-50"
            placeholder="admin@admin.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border-4 border-black p-3 font-semibold outline-none focus:bg-yellow-50"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="border-2 border-black bg-red-100 p-2 text-sm font-bold text-red-700">{error}</div>
        )}

        <Button type="submit" variant="primary" fullWidth disabled={loading} className="!text-base">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'ENTRAR'}
        </Button>
      </form>
    </div>
  );
};

const Dashboard: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) {
        setError(`Error ${res.status} al cargar las métricas.`);
        return;
      }
      const body = (await res.json()) as AdminStats;
      setStats(body);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString('es-ES'));
    } catch {
      setError('No se pudo conectar con el servidor.');
    }
  }, [token, onLogout]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (!stats) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-white">
        {error ? (
          <>
            <p className="font-bold">{error}</p>
            <Button onClick={fetchStats} variant="secondary" className="!text-base">
              <RefreshCcw className="mr-2 h-4 w-4" /> Reintentar
            </Button>
          </>
        ) : (
          <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
        )}
      </div>
    );
  }

  const { comics, ai, cache, recent } = stats;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-4 border-black bg-white p-4 text-[#00338D] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <h1 className="text-2xl font-black uppercase">Monitor KPMG Comic</h1>
            <p className="text-xs font-semibold text-gray-600">
              {lastUpdated ? `Actualizado ${lastUpdated} · cada ${POLL_INTERVAL_MS / 1000}s` : 'Cargando…'}
              {error ? ` · ${error}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchStats} variant="secondary" className="!text-xs !py-2 !px-3 !shadow-none !border-2">
              <RefreshCcw className="mr-1 h-4 w-4" /> Actualizar
            </Button>
            <Button onClick={() => downloadStatsCsv(stats)} variant="primary" className="!text-xs !py-2 !px-3 !shadow-none !border-2">
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            <Button onClick={onLogout} variant="danger" className="!text-xs !py-2 !px-3 !shadow-none !border-2">
              <LogOut className="mr-1 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>

        {/* Main stat cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Cómics creados"
            value={comics.succeeded}
            accent="bg-[#00A3A1] text-white"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Fallidos"
            value={comics.failed}
            accent="bg-[#6D2077] text-white"
            icon={<XCircle className="h-5 w-5" />}
          />
          <StatCard
            label="En curso"
            value={comics.active}
            accent="bg-[#0091DA] text-white"
            icon={<Activity className="h-5 w-5" />}
          />
          <StatCard
            label="Tasa de éxito"
            value={`${comics.successRate}%`}
            accent="bg-yellow-300 text-black"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Intentos totales" value={comics.started} accent="bg-white text-[#00338D]" icon={<Activity className="h-5 w-5" />} />
          <StatCard label="Duración media" value={formatDuration(comics.avgDurationMs)} accent="bg-white text-[#00338D]" icon={<Clock className="h-5 w-5" />} />
          <StatCard label="Duración p95" value={formatDuration(comics.p95DurationMs)} accent="bg-white text-[#00338D]" icon={<Clock className="h-5 w-5" />} />
          <StatCard label="Viñetas reusadas" value={cache.panelHits} accent="bg-white text-[#00338D]" icon={<RefreshCcw className="h-5 w-5" />} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Failures by code */}
          <div className="border-4 border-black bg-white p-4 text-[#00338D] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="mb-3 text-lg font-black uppercase">Fallos por tipo</h2>
            {Object.keys(comics.failuresByCode).length === 0 ? (
              <p className="text-sm font-semibold text-gray-500">Sin fallos registrados. 🎉</p>
            ) : (
              <ul className="space-y-1">
                {(Object.entries(comics.failuresByCode) as [string, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => (
                    <li key={code} className="flex items-center justify-between border-b border-gray-200 py-1 text-sm">
                      <span className="font-mono">{code}</span>
                      <span className="font-black">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {/* AI calls */}
          <div className="border-4 border-black bg-white p-4 text-[#00338D] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="mb-3 text-lg font-black uppercase">Llamadas a la IA</h2>
            {Object.keys(ai).length === 0 ? (
              <p className="text-sm font-semibold text-gray-500">Aún no hay llamadas.</p>
            ) : (
              <ul className="space-y-2">
                {(Object.entries(ai) as [string, AiSummary][]).map(([kind, summary]) => (
                  <li key={kind} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase">{kind === 'image' ? 'Imágenes' : kind === 'text' ? 'Textos' : kind}</span>
                      <span className="font-mono">
                        <span className="text-green-700">{summary.ok} ok</span>
                        {' · '}
                        <span className="text-red-700">{summary.failed} fallos</span>
                        {` / ${summary.total}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent events */}
        <div className="border-4 border-black bg-white p-4 text-[#00338D] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="mb-3 text-lg font-black uppercase">Últimos cómics</h2>
          {recent.length === 0 ? (
            <p className="text-sm font-semibold text-gray-500">Todavía no se ha generado ningún cómic.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-black text-xs uppercase">
                    <th className="py-2 pr-3">Hora</th>
                    <th className="py-2 pr-3">Resultado</th>
                    <th className="py-2 pr-3">Motivo</th>
                    <th className="py-2 pr-3">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((event, index) => (
                    <tr key={`${event.requestId}-${index}`} className="border-b border-gray-200">
                      <td className="py-2 pr-3 font-mono text-xs">{formatTime(event.ts)}</td>
                      <td className="py-2 pr-3">
                        {event.outcome === 'success' ? (
                          <span className="font-bold text-green-700">✓ OK</span>
                        ) : (
                          <span className="font-bold text-red-700">✕ Fallo</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{event.code || '—'}</td>
                      <td className="py-2 pr-3">{formatDuration(event.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="pb-6 text-center text-xs text-white/60">
          Métricas en memoria del servidor · se reinician al reiniciar la instancia.
        </p>
      </div>
    </div>
  );
};

export const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));

  const handleLoginSuccess = (newToken: string) => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-[#1E49E2] bg-[radial-gradient(#ffffff11_1px,transparent_1px)] bg-[length:20px_20px]">
      {token ? <Dashboard token={token} onLogout={handleLogout} /> : <LoginForm onSuccess={handleLoginSuccess} />}
    </div>
  );
};
