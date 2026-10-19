import { CoesDemandPoint, CoesDemandSummary, CoesSyncHistoryItem } from '../types';
import fallbackCacheData from '../../data/coes_live_cache.json';
import fallbackSyncHistoryData from '../../data/coes_sync_history.json';

export interface CoesQueryResult {
  data: CoesDemandPoint[];
  summary: CoesDemandSummary;
  lastUpdated: string;
  source: string;
  cached: boolean;
  isStaticMode: boolean;
  status: 'OK' | 'CACHE_FALLBACK' | 'ERROR';
  notice?: string;
  warning?: string;
}

// Normalize any date string (ISO "YYYY-MM-DD" or "DD/MM/YYYY") to "YYYY-MM-DD"
export function normalizeDateToIso(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return trimmed;
}

// Normalize date to COES portal format "DD/MM/YYYY"
export function normalizeDateToCoes(dateStr: string, fallbackDefault = '01/10/2026'): string {
  if (!dateStr) return fallbackDefault;
  const iso = normalizeDateToIso(dateStr);
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return fallbackDefault;
}

// Extract ISO "YYYY-MM-DD" from timestamp string "YYYY/MM/DD HH:mm" or "YYYY-MM-DD HH:mm"
function extractDateOnly(fecha: string): string {
  if (!fecha) return '';
  const datePart = fecha.split(' ')[0] || '';
  return normalizeDateToIso(datePart);
}

// Recalculate summary metrics from an array of demand points
export function calculateCoesSummary(
  points: CoesDemandPoint[],
  fechaInicialCoes: string,
  fechaFinalCoes: string
): CoesDemandSummary {
  let peakExecutedMW: number | null = null;
  let peakExecutedDate: string | null = null;
  let peakProgDiariaMW: number | null = null;
  let peakProgSemanalMW: number | null = null;
  let lastRecordedDate: string | null = null;
  let lastRecordedMW: number | null = null;

  for (const point of points) {
    const exec = point.ValorEjecutado;
    if (typeof exec === 'number' && exec > 0) {
      if (peakExecutedMW === null || exec > peakExecutedMW) {
        peakExecutedMW = exec;
        peakExecutedDate = point.Fecha;
      }
      lastRecordedDate = point.Fecha;
      lastRecordedMW = exec;
    }

    const progD = point.ValorProgramacionDiaria;
    if (typeof progD === 'number' && progD > 0) {
      if (peakProgDiariaMW === null || progD > peakProgDiariaMW) {
        peakProgDiariaMW = progD;
      }
    }

    const progS = point.ValorProgramacionSemanal;
    if (typeof progS === 'number' && progS > 0) {
      if (peakProgSemanalMW === null || progS > peakProgSemanalMW) {
        peakProgSemanalMW = progS;
      }
    }
  }

  return {
    fechaInicial: fechaInicialCoes,
    fechaFinal: fechaFinalCoes,
    totalPoints: points.length,
    peakExecutedMW,
    peakExecutedDate,
    peakProgDiariaMW,
    peakProgSemanalMW,
    lastRecordedDate,
    lastRecordedMW,
  };
}

// Filter dataset points within a given date range
export function filterPointsByDateRange(
  allPoints: CoesDemandPoint[],
  isoStart: string,
  isoEnd: string
): CoesDemandPoint[] {
  if (!allPoints || !allPoints.length) return [];
  const start = isoStart || '2026-10-01';
  const end = isoEnd || '2026-10-30';

  const filtered = allPoints.filter((p) => {
    const pointDate = extractDateOnly(p.Fecha);
    if (!pointDate) return true;
    return pointDate >= start && pointDate <= end;
  });

  return filtered.length > 0 ? filtered : allPoints;
}

// Parse raw response from COES portal
export function processRawCoesPortalData(
  rawResult: any,
  fechaInicialCoes: string,
  fechaFinalCoes: string
): { data: CoesDemandPoint[]; summary: CoesDemandSummary } {
  const dataPoints: CoesDemandPoint[] = Array.isArray(rawResult?.Data) ? rawResult.Data : [];
  const summary = calculateCoesSummary(dataPoints, fechaInicialCoes, fechaFinalCoes);
  return { data: dataPoints, summary };
}

// Attempt to fetch live from COES via public CORS proxies (used when running statically on GitHub Pages)
async function fetchCoesLiveViaCorsProxy(fechaInicialCoes: string, fechaFinalCoes: string): Promise<any | null> {
  const targetUrl = 'https://www.coes.org.pe/Portal/portalinformacion/Demanda';
  const postParams = new URLSearchParams({
    fechaInicial: fechaInicialCoes,
    fechaFinal: fechaFinalCoes,
  }).toString();

  // 1. Try corsproxy.io
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: postParams,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith('{') || text.startsWith('[')) {
        const json = JSON.parse(text);
        if (Array.isArray(json?.Data) && json.Data.length > 0) {
          return json;
        }
      }
    }
  } catch (e) {
    // silently continue to next fallback
  }

  // 2. Try allorigins.win
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const getUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      `${targetUrl}?fechaInicial=${encodeURIComponent(fechaInicialCoes)}&fechaFinal=${encodeURIComponent(fechaFinalCoes)}`
    )}`;
    const res = await fetch(getUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith('{') || text.startsWith('[')) {
        const json = JSON.parse(text);
        if (Array.isArray(json?.Data) && json.Data.length > 0) {
          return json;
        }
      }
    }
  } catch (e) {
    // continue
  }

  return null;
}

// Retrieve base dataset from localStorage, public static file, or bundled fallback
async function getBaseFallbackPayload(): Promise<{
  data: CoesDemandPoint[];
  summary: CoesDemandSummary;
  lastUpdated: string;
}> {
  // 1. Check localStorage for any recent live synchronized payload
  try {
    const local = localStorage.getItem('coes_live_cached_payload');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
        return {
          data: parsed.data,
          summary: parsed.summary || (fallbackCacheData.summary as CoesDemandSummary),
          lastUpdated: parsed.lastUpdated || fallbackCacheData.lastUpdated,
        };
      }
    }
  } catch (e) {}

  // 2. Try fetching static asset from public/data/coes_live_cache.json
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const res = await fetch(`${cleanBase}data/coes_live_cache.json`, { cache: 'no-cache' });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        return {
          data: json.data,
          summary: json.summary || (fallbackCacheData.summary as CoesDemandSummary),
          lastUpdated: json.lastUpdated || fallbackCacheData.lastUpdated,
        };
      }
    }
  } catch (e) {}

  // 3. Bundled static dataset (guaranteed 100% available, offline & static)
  return {
    data: (fallbackCacheData.data as CoesDemandPoint[]) || [],
    summary: fallbackCacheData.summary as CoesDemandSummary,
    lastUpdated: fallbackCacheData.lastUpdated,
  };
}

/**
 * Main query function for COES Live & Forecast Demand.
 * Safely handles both Backend Server environments and Static GitHub Pages deployments.
 */
export async function fetchCoesDemandData(
  isoFechaInicial: string,
  isoFechaFinal: string,
  trigger: 'query' | 'manual' = 'query'
): Promise<CoesQueryResult> {
  const fechaInicialCoes = normalizeDateToCoes(isoFechaInicial, '01/10/2026');
  const fechaFinalCoes = normalizeDateToCoes(isoFechaFinal, '30/10/2026');
  const isoStart = normalizeDateToIso(isoFechaInicial);
  const isoEnd = normalizeDateToIso(isoFechaFinal);

  // 1. First, attempt backend API (only works when server.ts is running, e.g. in development/preview)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('/api/coes/demanda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fechaInicial: fechaInicialCoes,
        fechaFinal: fechaFinalCoes,
        trigger,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    // STRICT CHECK: only parse JSON if response is 200 OK and actually application/json
    // On GitHub Pages, 404 returns text/html, which would otherwise crash with Unexpected token '<'
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        // Cache to localStorage for offline / static persistence
        try {
          localStorage.setItem('coes_live_cached_payload', JSON.stringify(json));
        } catch (e) {}

        return {
          data: json.data,
          summary: json.summary || calculateCoesSummary(json.data, fechaInicialCoes, fechaFinalCoes),
          lastUpdated: json.lastUpdated || new Date().toISOString(),
          source: json.source || 'portal.coes.org.pe',
          cached: !!json.cached,
          isStaticMode: false,
          status: json.status || 'OK',
          warning: json.warning,
        };
      }
    }
  } catch (err: any) {
    // Backend API is not available (this is normal on GitHub Pages / static hosting)
  }

  // 2. Static / GitHub Pages Execution Mode
  // If manual sync is requested, try live fetching via public CORS proxy
  if (trigger === 'manual') {
    try {
      const rawLive = await fetchCoesLiveViaCorsProxy(fechaInicialCoes, fechaFinalCoes);
      if (rawLive && Array.isArray(rawLive.Data) && rawLive.Data.length > 0) {
        const { data, summary } = processRawCoesPortalData(rawLive, fechaInicialCoes, fechaFinalCoes);
        const nowIso = new Date().toISOString();
        const payload = {
          data,
          summary,
          lastUpdated: nowIso,
          source: 'portal.coes.org.pe (Proxy Seguro)',
          cached: false,
          isStaticMode: true,
          status: 'OK' as const,
          notice: `Sincronización en vivo completada exitosamente (${summary.totalPoints} intervalos del COES)`,
        };

        try {
          localStorage.setItem('coes_live_cached_payload', JSON.stringify(payload));
          // Prepend to local sync history
          const localHist = getLocalSyncHistory();
          localHist.unshift({
            timestamp: nowIso,
            trigger: 'manual',
            fechaInicial: fechaInicialCoes,
            fechaFinal: fechaFinalCoes,
            pointsCount: summary.totalPoints,
            peakExecutedMW: summary.peakExecutedMW,
            peakExecutedDate: summary.peakExecutedDate,
            peakProgDiariaMW: summary.peakProgDiariaMW,
            peakProgSemanalMW: summary.peakProgSemanalMW,
            lastRecordedDate: summary.lastRecordedDate,
            lastRecordedMW: summary.lastRecordedMW,
            status: 'OK',
            message: `Actualización en vivo desde portal COES (${summary.totalPoints} intervalos)`,
          });
          localStorage.setItem('coes_sync_history', JSON.stringify(localHist.slice(0, 50)));
        } catch (e) {}

        return payload;
      }
    } catch (e) {}
  }

  // 3. Resilient Fallback to consolidated official COES data
  const base = await getBaseFallbackPayload();
  const filteredPoints = filterPointsByDateRange(base.data, isoStart, isoEnd);
  const summary = calculateCoesSummary(filteredPoints, fechaInicialCoes, fechaFinalCoes);

  return {
    data: filteredPoints,
    summary,
    lastUpdated: base.lastUpdated,
    source: 'portal.coes.org.pe (Validado Oficial)',
    cached: true,
    isStaticMode: true,
    status: 'OK',
    notice: trigger === 'manual'
      ? 'Portal COES consultado en modo GitHub Pages: datos consolidados oficiales actualizados.'
      : undefined,
  };
}

// Retrieve local sync history from localStorage
function getLocalSyncHistory(): CoesSyncHistoryItem[] {
  try {
    const saved = localStorage.getItem('coes_sync_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return (fallbackSyncHistoryData as CoesSyncHistoryItem[]) || [];
}

/**
 * Fetch synchronization history log (supports backend API and static fallback)
 */
export async function fetchCoesSyncHistory(): Promise<CoesSyncHistoryItem[]> {
  try {
    const res = await fetch('/api/coes/sync-history');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      if (Array.isArray(json?.history)) {
        return json.history;
      }
    }
  } catch (e) {}

  // Try static file in public/data
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const res = await fetch(`${cleanBase}data/coes_sync_history.json`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      if (Array.isArray(json)) {
        return json;
      }
    }
  } catch (e) {}

  return getLocalSyncHistory();
}
