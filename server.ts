import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Persistent storage file
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'custom_records.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PUBLIC_DATA_DIR = path.resolve(__dirname, 'public', 'data');
if (!fs.existsSync(PUBLIC_DATA_DIR)) {
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
}

function readCustomRecords(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading custom records from disk:', err);
  }
  return [];
}

function writeCustomRecords(records: any[]): boolean {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
    try {
      fs.writeFileSync(path.resolve(PUBLIC_DATA_DIR, 'custom_records.json'), JSON.stringify(records, null, 2), 'utf-8');
    } catch (e) {}
    return true;
  } catch (err) {
    console.error('Error writing custom records to disk:', err);
    return false;
  }
}

// Required security password
const REQUIRED_PASSWORD = 'BMSRP2026';

// --- API Endpoints ---

// 1. Fetch all custom records (public read for dashboard visualization)
app.get('/api/custom-records', (_req, res) => {
  const records = readCustomRecords();
  res.json({ records });
});

// 2. Save or update a custom record (requires BMSRP2026 password)
app.post('/api/custom-records', (req, res) => {
  const { password, record } = req.body || {};
  if (password !== REQUIRED_PASSWORD) {
    return res.status(403).json({ error: 'Contraseña no autorizada. Clave requerida: BMSRP2026' });
  }

  if (!record || !record.id) {
    return res.status(400).json({ error: 'Datos de registro incompletos o sin ID' });
  }

  const current = readCustomRecords();
  const filtered = current.filter((r: any) => r.id !== record.id);
  const updated = [...filtered, record];
  writeCustomRecords(updated);
  return res.json({ success: true, records: updated });
});

// 3. Delete a custom record (requires BMSRP2026 password)
app.delete('/api/custom-records/:id', (req, res) => {
  const { password } = req.body || {};
  if (password !== REQUIRED_PASSWORD) {
    return res.status(403).json({ error: 'Contraseña no autorizada. Clave requerida: BMSRP2026' });
  }

  const { id } = req.params;
  const current = readCustomRecords();
  const updated = current.filter((r: any) => r.id !== id);
  writeCustomRecords(updated);
  return res.json({ success: true, records: updated });
});

// 4. Clear all custom records (requires BMSRP2026 password)
app.post('/api/custom-records/clear', (req, res) => {
  const { password } = req.body || {};
  if (password !== REQUIRED_PASSWORD) {
    return res.status(403).json({ error: 'Contraseña no autorizada. Clave requerida: BMSRP2026' });
  }

  writeCustomRecords([]);
  return res.json({ success: true, records: [] });
});

// --- COES Demanda Live Proxy & Auto-Sync Engine ---
const COES_CACHE_FILE = path.resolve(DATA_DIR, 'coes_live_cache.json');
const COES_SYNC_HISTORY_FILE = path.resolve(DATA_DIR, 'coes_sync_history.json');

function readCoesCache(): any | null {
  try {
    if (fs.existsSync(COES_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(COES_CACHE_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading COES cache:', err);
  }
  return null;
}

function writeCoesCache(payload: any) {
  try {
    fs.writeFileSync(COES_CACHE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    try {
      fs.writeFileSync(path.resolve(PUBLIC_DATA_DIR, 'coes_live_cache.json'), JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {}
  } catch (err) {
    console.error('Error writing COES cache:', err);
  }
}

function readSyncHistory(): any[] {
  try {
    if (fs.existsSync(COES_SYNC_HISTORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(COES_SYNC_HISTORY_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading COES sync history:', err);
  }
  return [];
}

function recordSyncHistory(entry: {
  timestamp: string;
  trigger: 'auto-daily-8am' | 'manual' | 'query';
  fechaInicial: string;
  fechaFinal: string;
  pointsCount: number;
  peakExecutedMW: number | null;
  peakExecutedDate: string | null;
  peakProgDiariaMW: number | null;
  peakProgSemanalMW: number | null;
  lastRecordedDate: string | null;
  lastRecordedMW: number | null;
  status: 'OK' | 'CACHE_FALLBACK' | 'ERROR';
  message: string;
}) {
  try {
    const history = readSyncHistory();
    history.unshift(entry);
    // Keep last 100 historical snapshots
    const trimmed = history.slice(0, 100);
    fs.writeFileSync(COES_SYNC_HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
    try {
      fs.writeFileSync(path.resolve(PUBLIC_DATA_DIR, 'coes_sync_history.json'), JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch (e) {}
  } catch (err) {
    console.error('Error writing COES sync history:', err);
  }
}

// Convert YYYY-MM-DD to DD/MM/YYYY if needed
function normalizeToCoesDate(inputDate?: string, fallbackDefault = '01/10/2026'): string {
  if (!inputDate || typeof inputDate !== 'string') return fallbackDefault;
  const trimmed = inputDate.trim();
  if (trimmed.includes('/')) return trimmed;
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  return fallbackDefault;
}

async function fetchFromCoesPortal(fechaInicial: string, fechaFinal: string) {
  const params = new URLSearchParams();
  params.append('fechaInicial', fechaInicial);
  params.append('fechaFinal', fechaFinal);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch('https://www.coes.org.pe/Portal/portalinformacion/Demanda', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} from COES portal`);
    }

    const json = await response.json();
    return json;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function processCoesData(rawResult: any, fechaInicial: string, fechaFinal: string) {
  const dataPoints: any[] = Array.isArray(rawResult?.Data) ? rawResult.Data : [];
  let peakExecutedMW: number | null = null;
  let peakExecutedDate: string | null = null;
  let peakProgDiariaMW: number | null = null;
  let peakProgSemanalMW: number | null = null;
  let lastRecordedDate: string | null = null;
  let lastRecordedMW: number | null = null;

  for (const point of dataPoints) {
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
    data: dataPoints,
    chart: rawResult?.Chart || null,
    summary: {
      fechaInicial,
      fechaFinal,
      totalPoints: dataPoints.length,
      peakExecutedMW,
      peakExecutedDate,
      peakProgDiariaMW,
      peakProgSemanalMW,
      lastRecordedDate,
      lastRecordedMW,
    },
  };
}

// 5. Query COES Demanda (live from official portal or resilient cache)
app.post('/api/coes/demanda', async (req, res) => {
  const { fechaInicial: rawIni, fechaFinal: rawFin, trigger = 'query' } = req.body || {};
  const fechaInicial = normalizeToCoesDate(rawIni, '01/10/2026');
  const fechaFinal = normalizeToCoesDate(rawFin, '30/10/2026');

  try {
    console.log(`[COES Proxy] Consultando portal COES: ${fechaInicial} -> ${fechaFinal}...`);
    const rawResult = await fetchFromCoesPortal(fechaInicial, fechaFinal);
    const processed = processCoesData(rawResult, fechaInicial, fechaFinal);

    const nowIso = new Date().toISOString();
    const payload = {
      ...processed,
      lastUpdated: nowIso,
      source: 'portal.coes.org.pe',
      status: 'OK',
    };

    // Cache the latest response
    writeCoesCache(payload);

    // Record in history log
    recordSyncHistory({
      timestamp: nowIso,
      trigger: trigger as any,
      fechaInicial,
      fechaFinal,
      pointsCount: processed.summary.totalPoints,
      peakExecutedMW: processed.summary.peakExecutedMW,
      peakExecutedDate: processed.summary.peakExecutedDate,
      peakProgDiariaMW: processed.summary.peakProgDiariaMW,
      peakProgSemanalMW: processed.summary.peakProgSemanalMW,
      lastRecordedDate: processed.summary.lastRecordedDate,
      lastRecordedMW: processed.summary.lastRecordedMW,
      status: 'OK',
      message: `Sincronización exitosa con portal COES (${processed.summary.totalPoints} intervalos)`,
    });

    return res.json({
      success: true,
      cached: false,
      ...payload,
    });
  } catch (err: any) {
    console.warn(`[COES Proxy Error] No se pudo conectar directamente con COES: ${err.message}. Verificando caché...`);
    const cached = readCoesCache();
    if (cached) {
      recordSyncHistory({
        timestamp: new Date().toISOString(),
        trigger: trigger as any,
        fechaInicial,
        fechaFinal,
        pointsCount: cached.summary?.totalPoints || 0,
        peakExecutedMW: cached.summary?.peakExecutedMW || null,
        peakExecutedDate: cached.summary?.peakExecutedDate || null,
        peakProgDiariaMW: cached.summary?.peakProgDiariaMW || null,
        peakProgSemanalMW: cached.summary?.peakProgSemanalMW || null,
        lastRecordedDate: cached.summary?.lastRecordedDate || null,
        lastRecordedMW: cached.summary?.lastRecordedMW || null,
        status: 'CACHE_FALLBACK',
        message: `Servido desde caché local persistente: ${err.message}`,
      });

      return res.json({
        success: true,
        cached: true,
        warning: 'El portal del COES demoró en responder. Mostrando los datos más recientes guardados en caché.',
        ...cached,
      });
    }

    return res.status(502).json({
      error: 'No se pudo obtener información del portal del COES ni hay caché disponible.',
      details: err.message,
    });
  }
});

// 6. Get latest cached COES data & status
app.get('/api/coes/demanda/latest', (_req, res) => {
  const cached = readCoesCache();
  const history = readSyncHistory();
  return res.json({
    cached: cached !== null,
    data: cached,
    lastSync: history[0] || null,
  });
});

// 7. Get sync history log
app.get('/api/coes/sync-history', (_req, res) => {
  const history = readSyncHistory();
  return res.json({ history });
});

// 8. Trigger manual sync now
app.post('/api/coes/sync-now', async (req, res) => {
  const { fechaInicial: rawIni, fechaFinal: rawFin } = req.body || {};
  const fechaInicial = normalizeToCoesDate(rawIni, '01/10/2026');
  const fechaFinal = normalizeToCoesDate(rawFin, '30/10/2026');

  try {
    const rawResult = await fetchFromCoesPortal(fechaInicial, fechaFinal);
    const processed = processCoesData(rawResult, fechaInicial, fechaFinal);
    const nowIso = new Date().toISOString();

    const payload = {
      ...processed,
      lastUpdated: nowIso,
      source: 'portal.coes.org.pe',
      status: 'OK',
    };

    writeCoesCache(payload);
    recordSyncHistory({
      timestamp: nowIso,
      trigger: 'manual',
      fechaInicial,
      fechaFinal,
      pointsCount: processed.summary.totalPoints,
      peakExecutedMW: processed.summary.peakExecutedMW,
      peakExecutedDate: processed.summary.peakExecutedDate,
      peakProgDiariaMW: processed.summary.peakProgDiariaMW,
      peakProgSemanalMW: processed.summary.peakProgSemanalMW,
      lastRecordedDate: processed.summary.lastRecordedDate,
      lastRecordedMW: processed.summary.lastRecordedMW,
      status: 'OK',
      message: `Actualización manual completada (${processed.summary.totalPoints} intervalos)`,
    });

    return res.json({ success: true, ...payload });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Background daily 8:00 AM (Peru time UTC-5) Auto-Sync Engine
function setupDailyAutoSync() {
  setInterval(async () => {
    try {
      // Peru time is UTC-5
      const peruNow = new Date(Date.now() - 5 * 3600 * 1000);
      const peruHour = peruNow.getUTCHours();
      const peruDateStr = peruNow.toISOString().split('T')[0]; // YYYY-MM-DD

      // Check if hour is >= 8:00 AM
      if (peruHour >= 8) {
        const history = readSyncHistory();
        const alreadySyncedToday = history.some(
          (h) => h.timestamp.startsWith(peruDateStr) && (h.trigger === 'auto-daily-8am' || h.trigger === 'manual')
        );

        if (!alreadySyncedToday) {
          console.log(`[COES Scheduler] Ejecutando sincronización automática programada de las 8:00 AM (Fecha Perú: ${peruDateStr})...`);
          const rawResult = await fetchFromCoesPortal('01/10/2026', '30/10/2026');
          const processed = processCoesData(rawResult, '01/10/2026', '30/10/2026');
          const nowIso = new Date().toISOString();

          writeCoesCache({
            ...processed,
            lastUpdated: nowIso,
            source: 'portal.coes.org.pe',
            status: 'OK',
          });

          recordSyncHistory({
            timestamp: nowIso,
            trigger: 'auto-daily-8am',
            fechaInicial: '01/10/2026',
            fechaFinal: '30/10/2026',
            pointsCount: processed.summary.totalPoints,
            peakExecutedMW: processed.summary.peakExecutedMW,
            peakExecutedDate: processed.summary.peakExecutedDate,
            peakProgDiariaMW: processed.summary.peakProgDiariaMW,
            peakProgSemanalMW: processed.summary.peakProgSemanalMW,
            lastRecordedDate: processed.summary.lastRecordedDate,
            lastRecordedMW: processed.summary.lastRecordedMW,
            status: 'OK',
            message: `Actualización automática programada de las 08:00 AM ejecutada con éxito`,
          });
          console.log('[COES Scheduler] Sincronización automática de las 8:00 AM completada exitosamente.');
        }
      }
    } catch (e: any) {
      console.warn('[COES Scheduler] Fallo en la sincronización automática programada:', e.message);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}
setupDailyAutoSync();

// --- Server Lifecycle & Vite Integration ---
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Determine listening port
  let port = 3000;
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    port = parseInt(process.argv[portArgIdx + 1], 10) || 3000;
  } else if (process.env.PORT) {
    port = parseInt(process.env.PORT, 10) || 3000;
  }

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`> Servidor activo en http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Error al inicializar el servidor:', err);
  process.exit(1);
});
