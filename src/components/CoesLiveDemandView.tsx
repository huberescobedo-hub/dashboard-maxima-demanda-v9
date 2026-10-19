import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  Download,
  ExternalLink,
  History,
  TrendingUp,
  AlertCircle,
  Zap,
  CheckCircle2,
  Filter,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Info,
  Maximize2,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Power,
  Radio,
  BellRing,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Brush,
} from 'recharts';
import { CoesDemandPoint, CoesDemandSummary, CoesSyncHistoryItem } from '../types';
import { CoesSyncHistoryModal } from './CoesSyncHistoryModal';
import { fetchCoesDemandData, fetchCoesSyncHistory } from '../services/coesDataService';

// Helper to check if a timestamp belongs to Hora Punta (HP: 18:00 - 23:00)
function isHoraPunta(fecha: string): boolean {
  const time = fecha.split(' ')[1] || '';
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  return (h >= 18 && h < 23) || (h === 23 && m === 0);
}

export const CoesLiveDemandView: React.FC = () => {
  // Date range inputs (defaults to full month Oct 2026 as in COES screenshot)
  const [fechaInicial, setFechaInicial] = useState('2026-10-01');
  const [fechaFinal, setFechaFinal] = useState('2026-10-30');

  // Loading & State
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [dataPoints, setDataPoints] = useState<CoesDemandPoint[]>([]);
  const [summary, setSummary] = useState<CoesDemandSummary | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isCachedData, setIsCachedData] = useState(false);
  const [isStaticMode, setIsStaticMode] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync History
  const [syncHistory, setSyncHistory] = useState<CoesSyncHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Actions Accordion toggle
  const [showActionsPlan, setShowActionsPlan] = useState(false);

  // Individual toggle state for each of the Top 3 HP peak reference lines (1°, 2°, 3°)
  const [visibleHpLines, setVisibleHpLines] = useState<{ 1: boolean; 2: boolean; 3: boolean }>({
    1: true,
    2: true,
    3: true,
  });

  const toggleHpLine = useCallback((rank: 1 | 2 | 3) => {
    setVisibleHpLines((prev) => ({ ...prev, [rank]: !prev[rank] }));
  }, []);

  const allHpLinesVisible = visibleHpLines[1] && visibleHpLines[2] && visibleHpLines[3];

  const toggleAllHpLines = useCallback(() => {
    setVisibleHpLines((prev) => {
      const allOn = prev[1] && prev[2] && prev[3];
      return { 1: !allOn, 2: !allOn, 3: !allOn };
    });
  }, []);

  // Series visibility toggles (Ejecutado, Prog. Diaria, Prog. Semanal)
  const [visibleSeries, setVisibleSeries] = useState<{
    real: boolean;
    daily: boolean;
    weekly: boolean;
  }>({
    real: true,
    daily: true,
    weekly: true,
  });

  const toggleSeries = useCallback((key: 'real' | 'daily' | 'weekly') => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Dynamic Brush ruler range filter
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [syncTableWithBrush, setSyncTableWithBrush] = useState(false);

  // Zoom / Range filters on chart: 'D' (1 day), 'S' (1 week), 'M' (1 month), 'Todo'
  const [zoomRange, setZoomRange] = useState<'D' | 'S' | 'M' | 'Todo'>('Todo');

  // Table filters: all, hp (18-23h), hfp (fuera de punta), executed, projected
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilterType, setTableFilterType] = useState<'all' | 'hp' | 'hfp' | 'executed' | 'projected'>('all');

  // Fetch sync history (supports both backend API and static GitHub Pages)
  const loadSyncHistory = useCallback(async () => {
    try {
      const history = await fetchCoesSyncHistory();
      if (Array.isArray(history)) {
        setSyncHistory(history);
      }
    } catch (e) {
      console.warn('Error loading sync history:', e);
    }
  }, []);

  // Primary Query function calling coesDataService (resilient to static GitHub Pages & live servers)
  const queryCoesDemanda = useCallback(async (ini: string, fin: string, trigger: 'query' | 'manual' = 'query') => {
    setIsLoading(true);
    setErrorMessage(null);
    if (trigger === 'manual') setInfoNotice(null);

    try {
      const result = await fetchCoesDemandData(ini, fin, trigger);
      setDataPoints(result.data);
      setSummary(result.summary);
      setLastSyncTime(result.lastUpdated || new Date().toISOString());
      setIsCachedData(result.cached);
      setIsStaticMode(result.isStaticMode);
      if (result.notice) {
        setInfoNotice(result.notice);
      } else {
        setInfoNotice(null);
      }

      // Refresh history
      loadSyncHistory();
    } catch (err: any) {
      console.error('Error fetching COES Demanda:', err);
      setErrorMessage(err.message || 'No se pudo conectar al servidor de datos COES.');
    } finally {
      setIsLoading(false);
    }
  }, [loadSyncHistory]);

  // Initial load
  useEffect(() => {
    queryCoesDemanda(fechaInicial, fechaFinal, 'query');
    loadSyncHistory();
  }, []);

  // Quick preset ranges
  const applyPreset = (preset: 'oct2026' | 'last7' | 'last48h' | 'fullMonth') => {
    let ini = '2026-10-01';
    let fin = '2026-10-30';

    if (preset === 'last7') {
      ini = '2026-10-10';
      fin = '2026-10-17';
    } else if (preset === 'last48h') {
      ini = '2026-10-15';
      fin = '2026-10-17';
    } else if (preset === 'oct2026' || preset === 'fullMonth') {
      ini = '2026-10-01';
      fin = '2026-10-30';
    }

    setFechaInicial(ini);
    setFechaFinal(fin);
    queryCoesDemanda(ini, fin, 'query');
  };

  // Manual Trigger "Sincronizar Ahora"
  const handleSyncNow = async () => {
    setIsSyncingNow(true);
    await queryCoesDemanda(fechaInicial, fechaFinal, 'manual');
    setIsSyncingNow(false);
  };

  // ADVANCED KPI CALCULATIONS: Top 3 Picos en Hora Punta (HP), Telemetría en Vivo y Precisión
  const kpiStats = useMemo(() => {
    const defaultPeakItem = {
      rank: 1,
      mw: 0,
      fecha: '',
      isProjected: false,
      source: 'Sin datos' as 'Ejecutado Real' | 'Programación Diaria' | 'Programación Semanal' | 'Sin datos',
      realMW: 0,
      realDate: '',
      dailyMW: 0,
      dailyDate: '',
      weeklyMW: 0,
      weeklyDate: '',
      deltaWithFirst: 0,
    };

    if (!dataPoints.length) {
      return {
        topHp1: { ...defaultPeakItem, rank: 1 },
        topHp2: { ...defaultPeakItem, rank: 2 },
        topHp3: { ...defaultPeakItem, rank: 3 },
        maxHp: { mw: 0, fecha: '', isProjected: false, source: 'Ejecutado Real' },
        maxHfp: { mw: 0, fecha: '', isProjected: false, source: 'Ejecutado Real' },
        peakExecutedHp: { mw: 0, fecha: '' },
        peakExecutedHfp: { mw: 0, fecha: '' },
        peakProjectedHp: { mw: 0, fecha: '' },
        peakProjectedHfp: { mw: 0, fecha: '' },
        monthExecutedPeakMW: 0,
        monthExecutedPeakDate: '',
        lastExecutedMW: 0,
        lastExecutedDate: '',
        avgDeviationPct: 0,
        totalExecutedCount: 0,
        totalProjectedCount: 0,
        alertInfo: {
          level: 'NORMAL' as 'CRITICAL_TODAY' | 'UPCOMING_RECORD' | 'NEAR_RECORD_TODAY' | 'NORMAL',
          headline: 'Demanda mensual estable',
          description: '',
          targetDate: '',
          targetMW: 0,
          targetHour: '',
          isHP: true,
          deltaMW: 0,
        },
      };
    }

    // 1. Separate Peak in Hora Punta (HP) and Fuera de Hora Punta (HFP)
    let peakExecHp = 0;
    let peakExecHpDate = '';
    let peakExecHfp = 0;
    let peakExecHfpDate = '';

    let peakProjHp = 0;
    let peakProjHpDate = '';
    let peakProjHfp = 0;
    let peakProjHfpDate = '';

    let lastExec = 0;
    let lastExecDate = '';
    let executedCount = 0;
    let projectedCount = 0;
    let devSum = 0;
    let devCount = 0;

    // Map by day to obtain the highest peak per day in Hora Punta (HP: 18:00 - 23:00)
    // evaluating ALL 3 variables: Ejecutado, Programación Diaria y Programación Semanal
    const dailyHpMap = new Map<string, {
      execPeak: number;
      execDate: string;
      dailyProgPeak: number;
      dailyProgDate: string;
      weeklyProgPeak: number;
      weeklyProgDate: string;
    }>();

    dataPoints.forEach((p) => {
      const isHp = isHoraPunta(p.Fecha);
      const exec = p.ValorEjecutado;
      const daily = p.ValorProgramacionDiaria;
      const weekly = p.ValorProgramacionSemanal;
      const bestProj = (typeof daily === 'number' && daily > 0) ? daily : ((typeof weekly === 'number' && weekly > 0) ? weekly : null);

      if (typeof exec === 'number' && exec > 0) {
        executedCount++;
        lastExec = exec;
        lastExecDate = p.Fecha;

        if (isHp) {
          if (exec > peakExecHp) {
            peakExecHp = exec;
            peakExecHpDate = p.Fecha;
          }
        } else {
          if (exec > peakExecHfp) {
            peakExecHfp = exec;
            peakExecHfpDate = p.Fecha;
          }
        }

        if (typeof daily === 'number' && daily > 0) {
          const diffPct = ((daily - exec) / exec) * 100;
          devSum += Math.abs(diffPct);
          devCount++;
        }
      } else {
        // Future / projected point
        projectedCount++;
        if (bestProj !== null) {
          if (isHp) {
            if (bestProj > peakProjHp) {
              peakProjHp = bestProj;
              peakProjHpDate = p.Fecha;
            }
          } else {
            if (bestProj > peakProjHfp) {
              peakProjHfp = bestProj;
              peakProjHfpDate = p.Fecha;
            }
          }
        }
      }

      // Group by date during Hora Punta for Top 3 Peaks across ALL 3 variables
      if (isHp) {
        const dateKey = p.Fecha.split(' ')[0];
        const entry = dailyHpMap.get(dateKey) || {
          execPeak: 0,
          execDate: '',
          dailyProgPeak: 0,
          dailyProgDate: '',
          weeklyProgPeak: 0,
          weeklyProgDate: '',
        };

        if (typeof exec === 'number' && exec > 0) {
          if (exec > entry.execPeak) {
            entry.execPeak = exec;
            entry.execDate = p.Fecha;
          }
        }

        if (typeof daily === 'number' && daily > 0) {
          if (daily > entry.dailyProgPeak) {
            entry.dailyProgPeak = daily;
            entry.dailyProgDate = p.Fecha;
          }
        }

        if (typeof weekly === 'number' && weekly > 0) {
          if (weekly > entry.weeklyProgPeak) {
            entry.weeklyProgPeak = weekly;
            entry.weeklyProgDate = p.Fecha;
          }
        }

        dailyHpMap.set(dateKey, entry);
      }
    });

    // Determine Top 3 peaks in Hora Punta (HP) considering Ejecutado, Prog. Diaria y Prog. Semanal
    const dailyHpList = Array.from(dailyHpMap.entries()).map(([dateKey, val]) => {
      const hasExecutedInHp = val.execPeak > 0;
      let mw = 0;
      let fecha = '';
      let source: 'Ejecutado Real' | 'Programación Diaria' | 'Programación Semanal' = 'Ejecutado Real';
      let isProjected = false;

      if (hasExecutedInHp) {
        mw = val.execPeak;
        fecha = val.execDate;
        source = 'Ejecutado Real';
        isProjected = false;
      } else {
        // Unexecuted / future HP date: evaluate Prog. Diaria vs Prog. Semanal
        isProjected = true;
        if (val.dailyProgPeak > 0 && val.dailyProgPeak >= val.weeklyProgPeak) {
          mw = val.dailyProgPeak;
          fecha = val.dailyProgDate;
          source = 'Programación Diaria';
        } else if (val.weeklyProgPeak > 0) {
          mw = val.weeklyProgPeak;
          fecha = val.weeklyProgDate;
          source = 'Programación Semanal';
        } else if (val.dailyProgPeak > 0) {
          mw = val.dailyProgPeak;
          fecha = val.dailyProgDate;
          source = 'Programación Diaria';
        }
      }

      return {
        dateKey,
        mw,
        fecha,
        isProjected,
        source,
        realMW: val.execPeak,
        realDate: val.execDate,
        dailyMW: val.dailyProgPeak,
        dailyDate: val.dailyProgDate,
        weeklyMW: val.weeklyProgPeak,
        weeklyDate: val.weeklyProgDate,
      };
    }).filter((d) => d.mw > 0);

    dailyHpList.sort((a, b) => b.mw - a.mw);

    // Fallback: If query range has fewer than 3 days, pick top distinct 30-min HP intervals
    let top3List = [...dailyHpList];
    if (top3List.length < 3) {
      const intervalList: typeof dailyHpList = [];
      dataPoints.forEach((p) => {
        if (isHoraPunta(p.Fecha)) {
          const exec = (typeof p.ValorEjecutado === 'number' && p.ValorEjecutado > 0) ? p.ValorEjecutado : 0;
          const daily = (typeof p.ValorProgramacionDiaria === 'number' && p.ValorProgramacionDiaria > 0) ? p.ValorProgramacionDiaria : 0;
          const weekly = (typeof p.ValorProgramacionSemanal === 'number' && p.ValorProgramacionSemanal > 0) ? p.ValorProgramacionSemanal : 0;

          let mw = 0;
          let source: 'Ejecutado Real' | 'Programación Diaria' | 'Programación Semanal' = 'Ejecutado Real';
          let isProj = false;

          if (exec > 0) {
            mw = exec;
            source = 'Ejecutado Real';
            isProj = false;
          } else if (daily > 0 && daily >= weekly) {
            mw = daily;
            source = 'Programación Diaria';
            isProj = true;
          } else if (weekly > 0) {
            mw = weekly;
            source = 'Programación Semanal';
            isProj = true;
          } else if (daily > 0) {
            mw = daily;
            source = 'Programación Diaria';
            isProj = true;
          }

          if (mw > 0) {
            intervalList.push({
              dateKey: p.Fecha.split(' ')[0],
              mw,
              fecha: p.Fecha,
              isProjected: isProj,
              source,
              realMW: exec,
              realDate: exec > 0 ? p.Fecha : '',
              dailyMW: daily,
              dailyDate: daily > 0 ? p.Fecha : '',
              weeklyMW: weekly,
              weeklyDate: weekly > 0 ? p.Fecha : '',
            });
          }
        }
      });
      intervalList.sort((a, b) => b.mw - a.mw);
      const uniqueIntervals: typeof dailyHpList = [];
      const seen = new Set<string>();
      intervalList.forEach((it) => {
        if (!seen.has(it.fecha)) {
          seen.add(it.fecha);
          uniqueIntervals.push(it);
        }
      });
      top3List = uniqueIntervals.slice(0, 3);
    }

    const topHp1 = top3List[0]
      ? { ...top3List[0], rank: 1, deltaWithFirst: 0 }
      : { ...defaultPeakItem, rank: 1 };

    const topHp2 = top3List[1]
      ? { ...top3List[1], rank: 2, deltaWithFirst: topHp1.mw > 0 ? top3List[1].mw - topHp1.mw : 0 }
      : { ...defaultPeakItem, rank: 2 };

    const topHp3 = top3List[2]
      ? { ...top3List[2], rank: 3, deltaWithFirst: topHp1.mw > 0 ? top3List[2].mw - topHp1.mw : 0 }
      : { ...defaultPeakItem, rank: 3 };

    // Determine absolute MAX HP (either Real executed or Projected if future projection surpasses real)
    const maxHpIsProjected = peakProjHp > peakExecHp;
    const maxHp = {
      mw: maxHpIsProjected ? peakProjHp : peakExecHp,
      fecha: maxHpIsProjected ? peakProjHpDate : peakExecHpDate,
      isProjected: maxHpIsProjected,
      source: maxHpIsProjected ? 'Proyección COES' : 'Ejecutado Real',
    };

    // Determine absolute MAX HFP (either Real executed or Projected)
    const maxHfpIsProjected = peakProjHfp > peakExecHfp;
    const maxHfp = {
      mw: maxHfpIsProjected ? peakProjHfp : peakExecHfp,
      fecha: maxHfpIsProjected ? peakProjHfpDate : peakExecHfpDate,
      isProjected: maxHfpIsProjected,
      source: maxHfpIsProjected ? 'Proyección COES' : 'Ejecutado Real',
    };

    // Overall month executed peak in Hora Punta (HP)
    const monthExecutedHpPeakMW = topHp1.realMW > 0 ? topHp1.realMW : peakExecHp;
    const monthExecutedHpPeakDate = topHp1.realDate || peakExecHpDate;

    // Detect Today's Date from lastExecDate or system date
    const todayStr = lastExecDate ? lastExecDate.split(' ')[0] : '2026/10/19';

    // Find highest demand for TODAY in Hora Punta (HP)
    let todayHpMaxMW = 0;
    let todayHpMaxTime = '';

    dataPoints.forEach((p) => {
      if (p.Fecha.startsWith(todayStr) && isHoraPunta(p.Fecha)) {
        const time = p.Fecha.split(' ')[1] || '';
        const val = (typeof p.ValorEjecutado === 'number' && p.ValorEjecutado > 0)
          ? p.ValorEjecutado
          : (p.ValorProgramacionDiaria ?? p.ValorProgramacionSemanal ?? 0);
        if (val > todayHpMaxMW) {
          todayHpMaxMW = val;
          todayHpMaxTime = time;
        }
      }
    });

    // Detect if ANY projected future point in HP will break the record
    const highestFutureHpPeak = peakProjHp;
    const highestFutureHpDate = peakProjHpDate;

    // Determine Alert Level & Description strictly for Hora Punta (HP)
    let alertLevel: 'CRITICAL_TODAY' | 'UPCOMING_RECORD' | 'NEAR_RECORD_TODAY' | 'NORMAL' = 'NORMAL';
    let headline = '';
    let description = '';
    let deltaMW = 0;

    if (todayHpMaxMW > monthExecutedHpPeakMW && monthExecutedHpPeakMW > 0) {
      alertLevel = 'CRITICAL_TODAY';
      deltaMW = todayHpMaxMW - monthExecutedHpPeakMW;
      headline = '🚨 ALTA PROBABILIDAD: HOY SE REGISTRARÁ NUEVO RÉCORD EN HORA PUNTA (COES)';
      description = `El COES proyecta para hoy a las ${todayHpMaxTime} hrs una demanda de ${todayHpMaxMW.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW en Hora Punta (18:00 - 23:00), superando en +${deltaMW.toFixed(1)} MW el 1° récord de Hora Punta del mes (${monthExecutedHpPeakMW.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW).`;
    } else if (highestFutureHpPeak > monthExecutedHpPeakMW && monthExecutedHpPeakMW > 0) {
      alertLevel = 'UPCOMING_RECORD';
      deltaMW = highestFutureHpPeak - monthExecutedHpPeakMW;
      headline = `⚠️ ALERTA DE PROYECCIÓN: PRÓXIMO RÉCORD EN HORA PUNTA EL ${highestFutureHpDate.split(' ')[0]}`;
      description = `La programación del COES prevé alcanzar ${highestFutureHpPeak.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW en Hora Punta el ${highestFutureHpDate} (+${deltaMW.toFixed(1)} MW sobre el 1° pico ejecutado a la fecha). Se pronostica como la máxima demanda del mes.`;
    } else if (todayHpMaxMW >= monthExecutedHpPeakMW * 0.985 && monthExecutedHpPeakMW > 0) {
      alertLevel = 'NEAR_RECORD_TODAY';
      deltaMW = monthExecutedHpPeakMW - todayHpMaxMW;
      headline = '⚡ ALERTA: DÍA DE ALTA DEMANDA EN HORA PUNTA HOY';
      description = `El COES proyecta para hoy un pico de ${todayHpMaxMW.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW a las ${todayHpMaxTime} hrs en Hora Punta (98.5%+ del récord del mes). Alta probabilidad de impacto en potencia coincidente facturable.`;
    } else {
      alertLevel = 'NORMAL';
      headline = '✅ DEMANDA EN HORA PUNTA EN RANGOS ESTABLES';
      description = `El 1° récord en Hora Punta se mantiene en ${monthExecutedHpPeakMW.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW (${monthExecutedHpPeakDate}). Las proyecciones de hoy en HP no superan el pico registrado.`;
    }

    return {
      topHp1,
      topHp2,
      topHp3,
      maxHp,
      maxHfp,
      peakExecutedHp: { mw: peakExecHp, fecha: peakExecHpDate },
      peakExecutedHfp: { mw: peakExecHfp, fecha: peakExecHfpDate },
      peakProjectedHp: { mw: peakProjHp, fecha: peakProjHpDate },
      peakProjectedHfp: { mw: peakProjHfp, fecha: peakProjHfpDate },
      monthExecutedPeakMW: monthExecutedHpPeakMW,
      monthExecutedPeakDate: monthExecutedHpPeakDate,
      lastExecutedMW: lastExec,
      lastExecutedDate: lastExecDate,
      avgDeviationPct: devCount > 0 ? devSum / devCount : 0,
      totalExecutedCount: executedCount,
      totalProjectedCount: projectedCount,
      alertInfo: {
        level: alertLevel,
        headline,
        description,
        targetDate: alertLevel === 'CRITICAL_TODAY' ? todayStr : (highestFutureHpDate ? highestFutureHpDate.split(' ')[0] : todayStr),
        targetMW: alertLevel === 'CRITICAL_TODAY' ? todayHpMaxMW : highestFutureHpPeak,
        targetHour: todayHpMaxTime,
        isHP: true,
        deltaMW,
      },
    };
  }, [dataPoints]);

  // Chart data formatting & Zoom slicing
  const chartData = useMemo(() => {
    if (!dataPoints.length) return [];

    let dataset = dataPoints.map((item) => {
      const parts = item.Fecha.split(' ');
      const datePart = parts[0] || '';
      const timePart = parts[1] || '';
      const dateSub = datePart.split('/');
      const shortDate = dateSub.length === 3 ? `${parseInt(dateSub[2], 10)}/${dateSub[1]}` : datePart;

      const execVal = typeof item.ValorEjecutado === 'number' && item.ValorEjecutado > 0 
        ? Math.round(item.ValorEjecutado * 10) / 10 
        : null;

      const dailyVal = typeof item.ValorProgramacionDiaria === 'number' && item.ValorProgramacionDiaria > 0
        ? Math.round(item.ValorProgramacionDiaria * 10) / 10
        : null;

      const weeklyVal = typeof item.ValorProgramacionSemanal === 'number' && item.ValorProgramacionSemanal > 0
        ? Math.round(item.ValorProgramacionSemanal * 10) / 10
        : null;

      const isHp = isHoraPunta(item.Fecha);

      return {
        rawFecha: item.Fecha,
        displayLabel: `${shortDate} ${timePart}`,
        dateOnly: datePart,
        timeOnly: timePart,
        isHp,
        Ejecutado: execVal,
        'Programación Diaria': dailyVal,
        'Programación Semanal': weeklyVal,
      };
    });

    return dataset;
  }, [dataPoints]);

  // When data points change, initialize brush range to cover all points
  useEffect(() => {
    if (dataPoints.length > 0) {
      setBrushRange({ startIndex: 0, endIndex: dataPoints.length - 1 });
    }
  }, [dataPoints.length]);

  // Dynamic visible range computed from the interactive ruler handles (Brush)
  const activeVisibleRange = useMemo(() => {
    if (!chartData.length) return null;
    const startIdx = Math.max(0, Math.min(chartData.length - 1, brushRange?.startIndex ?? 0));
    const endIdx = Math.max(0, Math.min(chartData.length - 1, brushRange?.endIndex ?? (chartData.length - 1)));
    const startPoint = chartData[startIdx] || chartData[0];
    const endPoint = chartData[endIdx] || chartData[chartData.length - 1];
    const count = Math.max(1, endIdx - startIdx + 1);
    const hours = (count * 0.5).toFixed(1);
    const days = (count / 48).toFixed(1);

    return {
      startIdx,
      endIdx,
      startLabel: startPoint.rawFecha,
      endLabel: endPoint.rawFecha,
      count,
      hours: parseFloat(hours),
      days: parseFloat(days),
    };
  }, [chartData, brushRange]);

  // Handle ruler dragging (reduces or expands sampling window)
  const handleBrushChange = useCallback((range: any) => {
    if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number') {
      setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
    }
  }, []);

  // Zoom presets (Día, Semana, Mes, Todo) that move the ruler handles dynamically
  const handleZoomPreset = useCallback((mode: 'D' | 'S' | 'M' | 'Todo') => {
    setZoomRange(mode);
    if (!chartData.length) return;

    const total = chartData.length;
    const lastExecIdx = chartData.findLastIndex((p) => p.Ejecutado !== null);
    const centerIdx = lastExecIdx !== -1 ? lastExecIdx : Math.floor(total / 2);

    if (mode === 'D') {
      // 24 hours = 48 intervals of 30 min (centered around current time/peak)
      const start = Math.max(0, centerIdx - 36);
      const end = Math.min(total - 1, start + 48);
      setBrushRange({ startIndex: start, endIndex: end });
    } else if (mode === 'S') {
      // 7 days = 336 intervals of 30 min
      const start = Math.max(0, centerIdx - 240);
      const end = Math.min(total - 1, start + 336);
      setBrushRange({ startIndex: start, endIndex: end });
    } else if (mode === 'M') {
      // 30 days = up to 1440 points
      const start = 0;
      const end = Math.min(total - 1, 1440);
      setBrushRange({ startIndex: start, endIndex: end });
    } else if (mode === 'Todo') {
      setBrushRange({ startIndex: 0, endIndex: total - 1 });
    }
  }, [chartData]);

  // Date Range subtitle for chart (uses active ruler selection)
  const dateRangeSubtitle = useMemo(() => {
    if (activeVisibleRange) {
      return `${activeVisibleRange.startLabel} — ${activeVisibleRange.endLabel}`;
    }
    if (!dataPoints.length) return '';
    const first = dataPoints[0].Fecha.split(' ')[0];
    const last = dataPoints[dataPoints.length - 1].Fecha.split(' ')[0];
    return `${first} — ${last}`;
  }, [dataPoints, activeVisibleRange]);

  // Table filtering
  const filteredTableData = useMemo(() => {
    return dataPoints.filter((item, index) => {
      // Optional: filter table to match the exact dynamic ruler window
      if (syncTableWithBrush && brushRange) {
        if (index < brushRange.startIndex || index > brushRange.endIndex) {
          return false;
        }
      }

      // 1. Text search

      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        if (!item.Fecha.toLowerCase().includes(q)) {
          return false;
        }
      }

      const isHp = isHoraPunta(item.Fecha);

      // 2. Filter Type
      if (tableFilterType === 'hp') {
        if (!isHp) return false;
      } else if (tableFilterType === 'hfp') {
        if (isHp) return false;
      } else if (tableFilterType === 'executed') {
        if (!item.ValorEjecutado || item.ValorEjecutado <= 0) return false;
      } else if (tableFilterType === 'projected') {
        if (item.ValorEjecutado && item.ValorEjecutado > 0) return false;
      }

      return true;
    });
  }, [dataPoints, tableSearch, tableFilterType]);

  // Export CSV function
  const handleExportCSV = () => {
    if (!dataPoints.length) return;

    const headers = ['Fecha y Hora', 'Periodo', 'Ejecutado (MW)', 'Programacion Diaria (MW)', 'Programacion Semanal (MW)', 'Desviacion (MW)', 'Estado'];
    const rows = dataPoints.map((p) => {
      const exec = p.ValorEjecutado ?? '';
      const daily = p.ValorProgramacionDiaria ?? '';
      const weekly = p.ValorProgramacionSemanal ?? '';
      const diff = typeof p.ValorEjecutado === 'number' && typeof p.ValorProgramacionDiaria === 'number'
        ? (p.ValorProgramacionDiaria - p.ValorEjecutado).toFixed(3)
        : '';
      const estado = typeof p.ValorEjecutado === 'number' && p.ValorEjecutado > 0 ? 'Ejecutado' : 'Proyectado';
      const periodo = isHoraPunta(p.Fecha) ? 'Hora Punta (HP)' : 'Fuera de Punta (HFP)';
      return [p.Fecha, periodo, exec, daily, weekly, diff, estado].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `COES_Demanda_Ejecutado_vs_Proyeccion_HP_HFP_${fechaInicial}_a_${fechaFinal}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isAlertCritical = kpiStats.alertInfo.level === 'CRITICAL_TODAY';
  const isAlertWarning = kpiStats.alertInfo.level === 'UPCOMING_RECORD' || kpiStats.alertInfo.level === 'NEAR_RECORD_TODAY';

  return (
    <div className="space-y-6">
      {/* 1. HIGH-VISIBILITY ALERT BANNER: POSIBLE DÍA DE MÁXIMA DEMANDA SEGÚN COES */}
      <div
        className={`rounded-2xl p-5 shadow-sm border transition-all ${
          isAlertCritical
            ? 'bg-gradient-to-r from-rose-950 via-red-900 to-amber-950 border-rose-500/50 text-white shadow-rose-900/20'
            : isAlertWarning
            ? 'bg-gradient-to-r from-amber-950 via-orange-950 to-slate-900 border-amber-500/50 text-white shadow-amber-900/20'
            : 'bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 border-slate-700/60 text-white'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                isAlertCritical
                  ? 'bg-rose-500/20 border border-rose-400/40 text-rose-300 animate-pulse'
                  : isAlertWarning
                  ? 'bg-amber-500/20 border border-amber-400/40 text-amber-300'
                  : 'bg-blue-500/20 border border-blue-400/30 text-blue-300'
              }`}
            >
              {isAlertCritical ? (
                <Flame className="w-7 h-7 text-rose-400" />
              ) : isAlertWarning ? (
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              ) : (
                <ShieldAlert className="w-7 h-7 text-sky-400" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isAlertCritical
                      ? 'bg-rose-500/30 text-rose-200 border-rose-400/40'
                      : isAlertWarning
                      ? 'bg-amber-500/30 text-amber-200 border-amber-400/40'
                      : 'bg-blue-500/20 text-blue-200 border-blue-400/30'
                  }`}
                >
                  {isAlertCritical
                    ? '🚨 ALTA PROBABILIDAD DE PICO MENSUAL HOY'
                    : isAlertWarning
                    ? '⚠️ PROYECCIÓN COES EN ALTA DEMANDA'
                    : 'ESTADO DE LA DEMANDA MENSUAL'}
                </span>

                <span className="text-xs text-slate-300 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Ventana Clave: 18:00 - 23:00 hrs (Hora Punta)
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {kpiStats.alertInfo.headline}
              </h3>

              <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-4xl leading-relaxed">
                {kpiStats.alertInfo.description}
              </p>

              {/* Explicit Summary Pills: Real vs Proyectado with exact dates */}
              <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs">
                <div className="px-3 py-1 rounded-lg bg-black/40 border border-white/15 flex items-center gap-1.5 font-mono shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-slate-300">Pico Real Registrado:</span>
                  <span className="font-bold text-emerald-300">
                    {kpiStats.monthExecutedPeakMW > 0 ? `${kpiStats.monthExecutedPeakMW.toFixed(1)} MW` : '—'}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    el <strong className="text-slate-200">{kpiStats.monthExecutedPeakDate || 'Sin registro'}</strong> (REAL)
                  </span>
                </div>

                <div className="px-3 py-1 rounded-lg bg-black/40 border border-white/15 flex items-center gap-1.5 font-mono shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-slate-300">Pico Proyectado COES:</span>
                  <span className="font-bold text-amber-300">
                    {kpiStats.alertInfo.targetMW > 0 ? `${kpiStats.alertInfo.targetMW.toFixed(1)} MW` : '—'}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    previsto para <strong className="text-slate-200">{kpiStats.alertInfo.targetDate} {kpiStats.alertInfo.targetHour}</strong> (PROYECTADO)
                  </span>
                </div>
              </div>
            </div>
          </div>


          {/* Action Trigger Button */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => setShowActionsPlan(!showActionsPlan)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                isAlertCritical
                  ? 'bg-rose-500 hover:bg-rose-600 text-white ring-2 ring-rose-400/30'
                  : isAlertWarning
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold'
                  : 'bg-white hover:bg-slate-100 text-slate-900'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{showActionsPlan ? 'Ocultar Acciones' : 'Acciones de Gestión de Demanda'}</span>
              {showActionsPlan ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Operational Actions Box */}
        {showActionsPlan && (
          <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in duration-150">
            <div className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Protocolo de Operación y Ahorro en Potencia (Horas Punta 18:00 - 23:00)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-black/30 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <span className="font-bold text-amber-300 block mb-1">1. Desconexión de Cargas</span>
                Modulación o apagado de equipos de aire acondicionado (chillers), bombas de agua secundarias e iluminación no esencial.
              </div>
              <div className="bg-black/30 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <span className="font-bold text-emerald-300 block mb-1">2. Grupos de Respaldo</span>
                Arrancar grupos electrógenos diésel de emergencia a las 17:45 hrs para asumir la potencia y no absorber energía del SEIN.
              </div>
              <div className="bg-black/30 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <span className="font-bold text-sky-300 block mb-1">3. Monitoreo en Vivo</span>
                Supervisar la curva ascendente de carga en esta pantalla a partir de las 17:30 hrs para detectar la hora del pico coincidente.
              </div>
              <div className="bg-black/30 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                <span className="font-bold text-orange-300 block mb-1">4. Aviso a Operaciones</span>
                Prohibir pruebas eléctricas o encendido imprevisto de motores de gran potencia durante la ventana crítica de 18h a 23h.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Controls & Live Sync Status Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-sky-600 text-white rounded-xl shadow-xs">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {isStaticMode ? 'Datos Oficiales COES' : 'API COES Oficial en Vivo'}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  Interconexión SEIN Perú
                </span>
                {isCachedData && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    Modo Datos Consolidados
                  </span>
                )}
                {isStaticMode && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                    Modo GitHub Pages
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
                Monitoreo de Demanda Real vs. Proyección Diaria y Semanal
              </h2>
              <p className="text-xs text-slate-500">
                Alimentado directamente desde el portal oficial del COES con lecturas cada 30 minutos y seguimiento de picos en Horas Punta (HP) y Fuera de Punta (HFP).
              </p>
            </div>
          </div>

          {/* Sync status & Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="text-xs space-y-0.5 mr-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Última actualización:</span>
                <span className="font-bold text-slate-900">
                  {lastSyncTime
                    ? new Date(lastSyncTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                    : '08:00 AM'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Sync diario programado: <strong>08:00 AM (PET)</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncingNow || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-60 rounded-lg shadow-xs transition-all cursor-pointer"
              title="Consultar y actualizar ahora desde el portal del COES"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow || isLoading ? 'animate-spin' : ''}`} />
              <span>{isSyncingNow ? 'Actualizando...' : 'Sincronizar Ahora'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Ver el historial de consultas y evolutivo guardado a las 8:00 am"
            >
              <History className="w-3.5 h-3.5 text-amber-600" />
              <span>Evolutivo Guardado</span>
              {syncHistory.length > 0 && (
                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                  {syncHistory.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Query Form (Desde, Hasta, Consultar, Exportar) */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3 flex-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Desde:
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaInicial}
                  onChange={(e) => setFechaInicial(e.target.value)}
                  className="w-40 px-3 py-1.5 text-xs font-mono font-medium bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hasta:
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaFinal}
                  onChange={(e) => setFechaFinal(e.target.value)}
                  className="w-40 px-3 py-1.5 text-xs font-mono font-medium bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => queryCoesDemanda(fechaInicial, fechaFinal, 'query')}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:opacity-60 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Consultando...' : 'Consultar'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!dataPoints.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar</span>
            </button>
          </div>

          {/* Quick Presets & Official Link */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Accesos rápidos:</span>
            <button
              type="button"
              onClick={() => applyPreset('oct2026')}
              className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
            >
              Octubre 2026
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last7')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              Últimos 7 Días
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last48h')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              Últimas 48 Horas
            </button>

            <a
              href="https://www.coes.org.pe/Portal/portalinformacion/demanda?indicador=maxima"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors ml-1"
              title="Abrir página oficial de demanda en COES"
            >
              <span>Portal COES</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {infoNotice && (
          <div className="mt-4 p-3 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-600 shrink-0" />
              <span>{infoNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setInfoNotice(null)}
              className="text-sky-500 hover:text-sky-700 font-bold px-1.5 py-0.5 cursor-pointer rounded"
            >
              ×
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 3. TOP 3 PICOS EN HORA PUNTA (HP: 18:00 - 23:00) & KPIS EN TIEMPO REAL - BOTONES DE LÍNEA INTERACTIVA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: 1° Pico Máximo en HORA PUNTA (HP) - BOTÓN INTERACTIVO PARA BORRAR/MOSTRAR LÍNEA */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleHpLine(1)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleHpLine(1);
            }
          }}
          className={`rounded-xl border transition-all p-4 relative overflow-hidden flex flex-col justify-between cursor-pointer select-none text-left active:scale-[0.98] group ${
            visibleHpLines[1]
              ? 'border-rose-400 ring-2 ring-rose-200/80 bg-gradient-to-br from-white via-rose-50/50 to-rose-100/60 shadow-md hover:shadow-lg'
              : 'border-slate-300 bg-slate-50/80 opacity-60 hover:opacity-90 shadow-none hover:border-slate-400'
          }`}
          title={
            visibleHpLines[1]
              ? 'Click en este recuadro para BORRAR la línea del 1° Pico en la gráfica'
              : 'Click en este recuadro para MOSTRAR la línea del 1° Pico en la gráfica'
          }
        >
          <div>
            {/* Header: Title, Rank & Interactive Toggle Button */}
            <div className="flex items-center justify-between gap-1 text-xs font-bold text-rose-900">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    visibleHpLines[1] ? 'bg-rose-600 animate-pulse ring-2 ring-rose-300' : 'bg-slate-400'
                  }`}
                />
                <span className={visibleHpLines[1] ? 'text-rose-950 font-extrabold' : 'text-slate-600'}>
                  1° Pico Máx. HP
                </span>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold border border-rose-200">
                  1° Lugar
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all ${
                    visibleHpLines[1]
                      ? 'bg-rose-600 text-white border-rose-700 shadow-2xs group-hover:bg-rose-700'
                      : 'bg-white text-slate-500 border-slate-300 group-hover:bg-slate-100'
                  }`}
                >
                  {visibleHpLines[1] ? (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Línea Activa</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Línea Borrada</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* MW Value */}
            <div
              className={`text-2xl font-extrabold font-mono mt-1.5 tracking-tight transition-colors ${
                visibleHpLines[1] ? 'text-rose-950' : 'text-slate-600 line-through opacity-80'
              }`}
            >
              {kpiStats.topHp1.mw > 0
                ? `${kpiStats.topHp1.mw.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW`
                : '—'}
            </div>

            {/* Prominent Status Pill (REAL vs PROG. DIARIA vs PROG. SEMANAL) */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold shadow-2xs ${
                  kpiStats.topHp1.source === 'Ejecutado Real'
                    ? 'bg-emerald-600 text-white ring-1 ring-emerald-700/40'
                    : kpiStats.topHp1.source === 'Programación Diaria'
                    ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-500/40'
                    : 'bg-orange-500 text-white ring-1 ring-orange-600/40'
                }`}
              >
                {kpiStats.topHp1.source === 'Ejecutado Real'
                  ? '✓ REAL EJECUTADO'
                  : kpiStats.topHp1.source === 'Programación Diaria'
                  ? '⏱️ PROG. DIARIA'
                  : '📅 PROG. SEMANAL'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {kpiStats.topHp1.source === 'Ejecutado Real'
                  ? '(Registrado SCADA)'
                  : kpiStats.topHp1.source === 'Programación Diaria'
                  ? '(Prog. Diaria COES)'
                  : '(Prog. Semanal COES)'}
              </span>
            </div>

            {/* Exact Date & Time Highlight Box */}
            <div className="mt-2.5 p-2 rounded-lg bg-rose-100/60 border border-rose-200 text-rose-950">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>
                  Fecha: <strong className="text-slate-900 font-mono">{kpiStats.topHp1.fecha || 'Sin fecha'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Footer Interactive Hint Button */}
          <div className="mt-2.5 pt-2 border-t border-rose-200/60 text-[10px] space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span>Variable de Pico:</span>
              <span className="font-mono font-bold text-slate-900">{kpiStats.topHp1.source}</span>
            </div>
            <div
              className={`flex items-center justify-between px-2 py-1 rounded font-semibold transition-all ${
                visibleHpLines[1]
                  ? 'bg-rose-200/60 text-rose-950 group-hover:bg-rose-300/70'
                  : 'bg-slate-200/70 text-slate-700 group-hover:bg-slate-300/80'
              }`}
            >
              <span className="flex items-center gap-1">
                {visibleHpLines[1] ? <Eye className="w-3 h-3 text-rose-700" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
                <span>{visibleHpLines[1] ? 'Línea roja en gráfica' : 'Línea borrada'}</span>
              </span>
              <span className="underline decoration-dotted text-[9px] font-bold">
                {visibleHpLines[1] ? 'Click para borrar' : 'Click para mostrar'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: 2° Pico Máximo en HORA PUNTA (HP) - BOTÓN INTERACTIVO PARA BORRAR/MOSTRAR LÍNEA */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleHpLine(2)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleHpLine(2);
            }
          }}
          className={`rounded-xl border transition-all p-4 relative overflow-hidden flex flex-col justify-between cursor-pointer select-none text-left active:scale-[0.98] group ${
            visibleHpLines[2]
              ? 'border-sky-400 ring-2 ring-sky-200/80 bg-gradient-to-br from-white via-sky-50/50 to-sky-100/60 shadow-md hover:shadow-lg'
              : 'border-slate-300 bg-slate-50/80 opacity-60 hover:opacity-90 shadow-none hover:border-slate-400'
          }`}
          title={
            visibleHpLines[2]
              ? 'Click en este recuadro para BORRAR la línea del 2° Pico en la gráfica'
              : 'Click en este recuadro para MOSTRAR la línea del 2° Pico en la gráfica'
          }
        >
          <div>
            {/* Header: Title, Rank & Interactive Toggle Button */}
            <div className="flex items-center justify-between gap-1 text-xs font-bold text-sky-900">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    visibleHpLines[2] ? 'bg-sky-600 animate-pulse ring-2 ring-sky-300' : 'bg-slate-400'
                  }`}
                />
                <span className={visibleHpLines[2] ? 'text-sky-950 font-extrabold' : 'text-slate-600'}>
                  2° Pico Máx. HP
                </span>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-extrabold border border-sky-200">
                  2° Lugar
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all ${
                    visibleHpLines[2]
                      ? 'bg-sky-600 text-white border-sky-700 shadow-2xs group-hover:bg-sky-700'
                      : 'bg-white text-slate-500 border-slate-300 group-hover:bg-slate-100'
                  }`}
                >
                  {visibleHpLines[2] ? (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Línea Activa</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Línea Borrada</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* MW Value */}
            <div
              className={`text-2xl font-extrabold font-mono mt-1.5 tracking-tight transition-colors ${
                visibleHpLines[2] ? 'text-sky-950' : 'text-slate-600 line-through opacity-80'
              }`}
            >
              {kpiStats.topHp2.mw > 0
                ? `${kpiStats.topHp2.mw.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW`
                : '—'}
            </div>

            {/* Prominent Status Pill (REAL vs PROG. DIARIA vs PROG. SEMANAL) */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold shadow-2xs ${
                  kpiStats.topHp2.source === 'Ejecutado Real'
                    ? 'bg-sky-700 text-white ring-1 ring-sky-800/40'
                    : kpiStats.topHp2.source === 'Programación Diaria'
                    ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-500/40'
                    : 'bg-orange-500 text-white ring-1 ring-orange-600/40'
                }`}
              >
                {kpiStats.topHp2.source === 'Ejecutado Real'
                  ? '✓ REAL EJECUTADO'
                  : kpiStats.topHp2.source === 'Programación Diaria'
                  ? '⏱️ PROG. DIARIA'
                  : '📅 PROG. SEMANAL'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {kpiStats.topHp2.source === 'Ejecutado Real'
                  ? '(Registrado SCADA)'
                  : kpiStats.topHp2.source === 'Programación Diaria'
                  ? '(Prog. Diaria COES)'
                  : '(Prog. Semanal COES)'}
              </span>
            </div>

            {/* Exact Date & Time Highlight Box */}
            <div className="mt-2.5 p-2 rounded-lg bg-sky-100/60 border border-sky-200 text-sky-950">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>
                  Fecha: <strong className="text-slate-900 font-mono">{kpiStats.topHp2.fecha || 'Sin fecha'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Footer Interactive Hint Button */}
          <div className="mt-2.5 pt-2 border-t border-sky-200/60 text-[10px] space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span>Dif. con 1°:</span>
              <span className="font-mono font-bold text-sky-800">
                {kpiStats.topHp2.deltaWithFirst !== 0 ? `${kpiStats.topHp2.deltaWithFirst.toFixed(1)} MW` : '—'}
              </span>
            </div>
            <div
              className={`flex items-center justify-between px-2 py-1 rounded font-semibold transition-all ${
                visibleHpLines[2]
                  ? 'bg-sky-200/60 text-sky-950 group-hover:bg-sky-300/70'
                  : 'bg-slate-200/70 text-slate-700 group-hover:bg-slate-300/80'
              }`}
            >
              <span className="flex items-center gap-1">
                {visibleHpLines[2] ? <Eye className="w-3 h-3 text-sky-700" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
                <span>{visibleHpLines[2] ? 'Línea azul en gráfica' : 'Línea borrada'}</span>
              </span>
              <span className="underline decoration-dotted text-[9px] font-bold">
                {visibleHpLines[2] ? 'Click para borrar' : 'Click para mostrar'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: 3° Pico Máximo en HORA PUNTA (HP) - BOTÓN INTERACTIVO PARA BORRAR/MOSTRAR LÍNEA */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleHpLine(3)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleHpLine(3);
            }
          }}
          className={`rounded-xl border transition-all p-4 relative overflow-hidden flex flex-col justify-between cursor-pointer select-none text-left active:scale-[0.98] group ${
            visibleHpLines[3]
              ? 'border-amber-400 ring-2 ring-amber-200/80 bg-gradient-to-br from-white via-amber-50/50 to-amber-100/60 shadow-md hover:shadow-lg'
              : 'border-slate-300 bg-slate-50/80 opacity-60 hover:opacity-90 shadow-none hover:border-slate-400'
          }`}
          title={
            visibleHpLines[3]
              ? 'Click en este recuadro para BORRAR la línea del 3° Pico en la gráfica'
              : 'Click en este recuadro para MOSTRAR la línea del 3° Pico en la gráfica'
          }
        >
          <div>
            {/* Header: Title, Rank & Interactive Toggle Button */}
            <div className="flex items-center justify-between gap-1 text-xs font-bold text-amber-900">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    visibleHpLines[3] ? 'bg-amber-500 animate-pulse ring-2 ring-amber-300' : 'bg-slate-400'
                  }`}
                />
                <span className={visibleHpLines[3] ? 'text-amber-950 font-extrabold' : 'text-slate-600'}>
                  3° Pico Máx. HP
                </span>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold border border-amber-200">
                  3° Lugar
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all ${
                    visibleHpLines[3]
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs group-hover:bg-amber-700'
                      : 'bg-white text-slate-500 border-slate-300 group-hover:bg-slate-100'
                  }`}
                >
                  {visibleHpLines[3] ? (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Línea Activa</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Línea Borrada</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* MW Value */}
            <div
              className={`text-2xl font-extrabold font-mono mt-1.5 tracking-tight transition-colors ${
                visibleHpLines[3] ? 'text-amber-950' : 'text-slate-600 line-through opacity-80'
              }`}
            >
              {kpiStats.topHp3.mw > 0
                ? `${kpiStats.topHp3.mw.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW`
                : '—'}
            </div>

            {/* Prominent Status Pill (REAL vs PROG. DIARIA vs PROG. SEMANAL) */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold shadow-2xs ${
                  kpiStats.topHp3.source === 'Ejecutado Real'
                    ? 'bg-amber-600 text-white ring-1 ring-amber-700/40'
                    : kpiStats.topHp3.source === 'Programación Diaria'
                    ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-500/40'
                    : 'bg-orange-500 text-white ring-1 ring-orange-600/40'
                }`}
              >
                {kpiStats.topHp3.source === 'Ejecutado Real'
                  ? '✓ REAL EJECUTADO'
                  : kpiStats.topHp3.source === 'Programación Diaria'
                  ? '⏱️ PROG. DIARIA'
                  : '📅 PROG. SEMANAL'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {kpiStats.topHp3.source === 'Ejecutado Real'
                  ? '(Registrado SCADA)'
                  : kpiStats.topHp3.source === 'Programación Diaria'
                  ? '(Prog. Diaria COES)'
                  : '(Prog. Semanal COES)'}
              </span>
            </div>

            {/* Exact Date & Time Highlight Box */}
            <div className="mt-2.5 p-2 rounded-lg bg-amber-100/60 border border-amber-200 text-amber-950">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Fecha: <strong className="text-slate-900 font-mono">{kpiStats.topHp3.fecha || 'Sin datos'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Footer Interactive Hint Button */}
          <div className="mt-2.5 pt-2 border-t border-amber-200/60 text-[10px] space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span>Dif. con 1°:</span>
              <span className="font-mono font-bold text-amber-800">
                {kpiStats.topHp3.deltaWithFirst !== 0 ? `${kpiStats.topHp3.deltaWithFirst.toFixed(1)} MW` : '—'}
              </span>
            </div>
            <div
              className={`flex items-center justify-between px-2 py-1 rounded font-semibold transition-all ${
                visibleHpLines[3]
                  ? 'bg-amber-200/60 text-amber-950 group-hover:bg-amber-300/70'
                  : 'bg-slate-200/70 text-slate-700 group-hover:bg-slate-300/80'
              }`}
            >
              <span className="flex items-center gap-1">
                {visibleHpLines[3] ? <Eye className="w-3 h-3 text-amber-700" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
                <span>{visibleHpLines[3] ? 'Línea ámbar en gráfica' : 'Línea borrada'}</span>
              </span>
              <span className="underline decoration-dotted text-[9px] font-bold">
                {visibleHpLines[3] ? 'Click para borrar' : 'Click para mostrar'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Último Ejecutado en Tiempo Real */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>Último Ejecutado en Tiempo Real</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1.5">
              {kpiStats.lastExecutedMW > 0
                ? `${kpiStats.lastExecutedMW.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW`
                : '—'}
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-900 text-white shadow-2xs">
                SCADA EN VIVO
              </span>
            </div>

            <div className="mt-2.5 p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Lectura: <strong className="text-slate-900 font-mono">{kpiStats.lastExecutedDate || 'Esperando datos'}</strong></span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
            Frecuencia de telemetría: cada 30 min
          </div>
        </div>

        {/* KPI 5: Precisión y Desviación */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>Desviación Prog. vs Real</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1.5">
              {kpiStats.avgDeviationPct > 0 ? `± ${kpiStats.avgDeviationPct.toFixed(2)} %` : '—'}
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
                ERROR DESPACHO RDO
              </span>
            </div>

            <div className="mt-2.5 p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs">
              <div className="font-semibold text-emerald-700">
                {kpiStats.totalExecutedCount} intervalos ejecutados
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {kpiStats.totalProjectedCount} intervalos proyectados
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
            Comparativo entre RDO y SCADA
          </div>
        </div>
      </div>

      {/* 4. Main Two-Column Container (Table on Left, Highcharts/Recharts Curve on Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Data Table with Period and Peak Indicators */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden h-[630px]">
          {/* Table Header Controls */}
          <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Registros de Demanda</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                  {filteredTableData.length} de {dataPoints.length}
                </span>
              </span>

              {/* Filter Type Buttons */}
              <div className="flex items-center gap-1 text-[11px] flex-wrap">
                <button
                  type="button"
                  onClick={() => setTableFilterType('all')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tableFilterType === 'all'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilterType('hp')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tableFilterType === 'hp'
                      ? 'bg-rose-600 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                  title="Horas de Punta (18:00 a 23:00)"
                >
                  Solo HP (18-23h)
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilterType('hfp')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tableFilterType === 'hfp'
                      ? 'bg-sky-600 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                  title="Fuera de Punta (00-18h y 23-24h)"
                >
                  Solo HFP
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilterType('executed')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tableFilterType === 'executed'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Ejecutado
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilterType('projected')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tableFilterType === 'projected'
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Proyectado
                </button>
              </div>
            </div>

            {/* Quick search in table */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filtrar por fecha u hora (ej: 17/10, 19:30, 11:30)..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Scrollable Table Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                <span>Cargando datos desde el portal COES...</span>
              </div>
            ) : filteredTableData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No se encontraron registros para los filtros seleccionados.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/90 text-slate-700 font-semibold uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-2 py-2.5 text-center">Tipo</th>
                    <th className="px-3 py-2.5 text-right text-blue-700">Ejecutado</th>
                    <th className="px-3 py-2.5 text-right text-teal-700">Prog. Diaria</th>
                    <th className="px-3 py-2.5 text-right text-orange-700">Prog. Semanal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredTableData.map((row, idx) => {
                    const isHp = isHoraPunta(row.Fecha);
                    const isHp1 = kpiStats.topHp1.mw > 0 && row.Fecha === kpiStats.topHp1.fecha;
                    const isHp2 = kpiStats.topHp2.mw > 0 && row.Fecha === kpiStats.topHp2.fecha;
                    const isHp3 = kpiStats.topHp3.mw > 0 && row.Fecha === kpiStats.topHp3.fecha;
                    const hasExecuted = typeof row.ValorEjecutado === 'number' && row.ValorEjecutado > 0;

                    return (
                      <tr
                        key={`${row.Fecha}-${idx}`}
                        className={`hover:bg-slate-50 transition-colors ${
                          isHp1
                            ? 'bg-rose-100/70 font-bold border-l-4 border-rose-500'
                            : isHp2
                            ? 'bg-sky-100/70 font-bold border-l-4 border-sky-500'
                            : isHp3
                            ? 'bg-amber-100/70 font-bold border-l-4 border-amber-500'
                            : idx % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isHp1 && (
                              <button
                                type="button"
                                onClick={() => toggleHpLine(1)}
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-extrabold border transition-all cursor-pointer ${
                                  visibleHpLines[1]
                                    ? 'bg-rose-200 text-rose-950 border-rose-300 shadow-2xs hover:bg-rose-300'
                                    : 'bg-slate-200 text-slate-600 border-slate-300 line-through opacity-70 hover:opacity-100'
                                }`}
                                title={visibleHpLines[1] ? '1° Pico HP activo • Click para borrar línea' : '1° Pico HP borrado • Click para mostrar línea'}
                              >
                                {visibleHpLines[1] ? <Eye className="w-2.5 h-2.5 text-rose-700" /> : <EyeOff className="w-2.5 h-2.5 text-slate-500" />}
                                <span>🏆 1° PICO HP ({kpiStats.topHp1.source})</span>
                              </button>
                            )}
                            {isHp2 && (
                              <button
                                type="button"
                                onClick={() => toggleHpLine(2)}
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-extrabold border transition-all cursor-pointer ${
                                  visibleHpLines[2]
                                    ? 'bg-sky-200 text-sky-950 border-sky-300 shadow-2xs hover:bg-sky-300'
                                    : 'bg-slate-200 text-slate-600 border-slate-300 line-through opacity-70 hover:opacity-100'
                                }`}
                                title={visibleHpLines[2] ? '2° Pico HP activo • Click para borrar línea' : '2° Pico HP borrado • Click para mostrar línea'}
                              >
                                {visibleHpLines[2] ? <Eye className="w-2.5 h-2.5 text-sky-700" /> : <EyeOff className="w-2.5 h-2.5 text-slate-500" />}
                                <span>🥈 2° PICO HP ({kpiStats.topHp2.source})</span>
                              </button>
                            )}
                            {isHp3 && (
                              <button
                                type="button"
                                onClick={() => toggleHpLine(3)}
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-extrabold border transition-all cursor-pointer ${
                                  visibleHpLines[3]
                                    ? 'bg-amber-200 text-amber-950 border-amber-300 shadow-2xs hover:bg-amber-300'
                                    : 'bg-slate-200 text-slate-600 border-slate-300 line-through opacity-70 hover:opacity-100'
                                }`}
                                title={visibleHpLines[3] ? '3° Pico HP activo • Click para borrar línea' : '3° Pico HP borrado • Click para mostrar línea'}
                              >
                                {visibleHpLines[3] ? <Eye className="w-2.5 h-2.5 text-amber-700" /> : <EyeOff className="w-2.5 h-2.5 text-slate-500" />}
                                <span>🥉 3° PICO HP ({kpiStats.topHp3.source})</span>
                              </button>
                            )}
                            <span className="font-medium">{row.Fecha}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isHp
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isHp ? 'HP' : 'HFP'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {hasExecuted ? (
                            <span className="font-bold text-blue-700">
                              {row.ValorEjecutado!.toLocaleString('es-PE', {
                                minimumFractionDigits: 3,
                                maximumFractionDigits: 3,
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic font-sans text-[11px]">— Proy.</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">
                          {typeof row.ValorProgramacionDiaria === 'number' ? (
                            row.ValorProgramacionDiaria.toLocaleString('es-PE', {
                              minimumFractionDigits: 3,
                              maximumFractionDigits: 3,
                            })
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">
                          {typeof row.ValorProgramacionSemanal === 'number' ? (
                            row.ValorProgramacionSemanal.toLocaleString('es-PE', {
                              minimumFractionDigits: 3,
                              maximumFractionDigits: 3,
                            })
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
            <span>HP: 18:00 a 23:00 hrs • HFP: Resto del día</span>
            <span>Unidad: <strong>Megavatios (MW)</strong></span>
          </div>
        </div>

        {/* Right Column: Multi-Series Chart with Dual Peak Reference Lines */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col h-[630px]">
          {/* Chart Header, Zoom & Reference Line Toggles */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zoom:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                {(['D', 'S', 'M', 'Todo'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleZoomPreset(mode)}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      zoomRange === mode
                        ? 'bg-white text-blue-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode === 'D' ? 'D (Día)' : mode === 'S' ? 'S (Semana)' : mode === 'M' ? 'M (Mes)' : 'Todo'}
                  </button>
                ))}
              </div>

              {/* Reference Lines Master Toggle */}
              <button
                type="button"
                onClick={toggleAllHpLines}
                className={`ml-2 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer select-none active:scale-95 ${
                  allHpLinesVisible
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
                title={allHpLinesVisible ? 'Click para ocultar las 3 líneas de referencia en la gráfica' : 'Click para mostrar las 3 líneas de referencia en la gráfica'}
              >
                {allHpLinesVisible ? '✓ Ocultar Todas las Líneas' : '+ Mostrar Todas las Líneas'}
              </button>
            </div>

            {/* Subtitle Range */}
            <div className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
              {dateRangeSubtitle}
            </div>
          </div>

          {/* Legend and Reference Indicators with Interactive Click-to-Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs font-medium text-slate-700 border-b border-slate-100 shrink-0">
            {/* Series Legend Toggle Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Curvas:</span>
              <button
                type="button"
                onClick={() => toggleSeries('real')}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold transition-all cursor-pointer select-none ${
                  visibleSeries.real
                    ? 'bg-sky-50 text-sky-950 border-sky-300 shadow-2xs hover:bg-sky-100'
                    : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60 hover:opacity-100'
                }`}
                title={visibleSeries.real ? 'Click para ocultar curva Ejecutado (Real)' : 'Click para mostrar curva Ejecutado (Real)'}
              >
                <span className={`w-3.5 h-1 rounded-full ${visibleSeries.real ? 'bg-[#33B8FF]' : 'bg-slate-400'}`} />
                <span>Ejecutado (Real)</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSeries('daily')}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium transition-all cursor-pointer select-none ${
                  visibleSeries.daily
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300 shadow-2xs hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60 hover:opacity-100'
                }`}
                title={visibleSeries.daily ? 'Click para ocultar curva Prog. Diaria' : 'Click para mostrar curva Prog. Diaria'}
              >
                <span className={`w-3.5 h-1 border-b-2 border-dashed ${visibleSeries.daily ? 'border-[#3DD19D]' : 'border-slate-400'}`} />
                <span>Prog. Diaria</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSeries('weekly')}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium transition-all cursor-pointer select-none ${
                  visibleSeries.weekly
                    ? 'bg-orange-50 text-orange-950 border-orange-300 shadow-2xs hover:bg-orange-100'
                    : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60 hover:opacity-100'
                }`}
                title={visibleSeries.weekly ? 'Click para ocultar curva Prog. Semanal' : 'Click para mostrar curva Prog. Semanal'}
              >
                <span className={`w-3.5 h-1 border-b-2 border-dashed ${visibleSeries.weekly ? 'border-[#FF7A33]' : 'border-slate-400'}`} />
                <span>Prog. Semanal</span>
              </button>
            </div>

            {/* Peak Reference Indicators strictly for Top 3 Hora Punta (HP) - Click to Hide / Show Line */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-0.5 hidden sm:inline">Picos HP:</span>
              {kpiStats.topHp1.mw > 0 && (
                <button
                  type="button"
                  onClick={() => toggleHpLine(1)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
                    visibleHpLines[1]
                      ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-2xs hover:bg-rose-100 ring-1 ring-rose-200/60'
                      : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 hover:opacity-100 line-through'
                  }`}
                  title={visibleHpLines[1] ? 'Click para borrar/ocultar la línea del 1° Pico HP' : 'Click para mostrar la línea del 1° Pico HP'}
                >
                  <span className={`w-2 h-2 rounded-full ${visibleHpLines[1] ? 'bg-rose-600 animate-pulse' : 'bg-slate-400'}`} />
                  <span>1° HP:</span>
                  <span className={`font-mono ${visibleHpLines[1] ? 'text-rose-700' : 'text-slate-500'}`}>
                    {kpiStats.topHp1.mw.toFixed(1)} MW
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9px] font-extrabold ${
                    !visibleHpLines[1]
                      ? 'bg-slate-200 text-slate-500'
                      : kpiStats.topHp1.source === 'Ejecutado Real'
                      ? 'bg-emerald-600 text-white'
                      : kpiStats.topHp1.source === 'Programación Diaria'
                      ? 'bg-amber-300 text-amber-950'
                      : 'bg-orange-500 text-white'
                  }`}>
                    {kpiStats.topHp1.source === 'Ejecutado Real' ? '✓ REAL' : (kpiStats.topHp1.source === 'Programación Diaria' ? '⏱️ DIARIA' : '📅 SEMANAL')}
                  </span>
                  <span className="text-slate-500 font-mono text-[9px]">({kpiStats.topHp1.fecha})</span>
                  {visibleHpLines[1] ? (
                    <Eye className="w-3.5 h-3.5 text-rose-600 ml-0.5 shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
                  )}
                </button>
              )}

              {kpiStats.topHp2.mw > 0 && (
                <button
                  type="button"
                  onClick={() => toggleHpLine(2)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
                    visibleHpLines[2]
                      ? 'bg-sky-50 border-sky-300 text-sky-950 shadow-2xs hover:bg-sky-100 ring-1 ring-sky-200/60'
                      : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 hover:opacity-100 line-through'
                  }`}
                  title={visibleHpLines[2] ? 'Click para borrar/ocultar la línea del 2° Pico HP' : 'Click para mostrar la línea del 2° Pico HP'}
                >
                  <span className={`w-2 h-2 rounded-full ${visibleHpLines[2] ? 'bg-sky-600' : 'bg-slate-400'}`} />
                  <span>2° HP:</span>
                  <span className={`font-mono ${visibleHpLines[2] ? 'text-sky-700' : 'text-slate-500'}`}>
                    {kpiStats.topHp2.mw.toFixed(1)} MW
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9px] font-extrabold ${
                    !visibleHpLines[2]
                      ? 'bg-slate-200 text-slate-500'
                      : kpiStats.topHp2.source === 'Ejecutado Real'
                      ? 'bg-sky-700 text-white'
                      : kpiStats.topHp2.source === 'Programación Diaria'
                      ? 'bg-amber-300 text-amber-950'
                      : 'bg-orange-500 text-white'
                  }`}>
                    {kpiStats.topHp2.source === 'Ejecutado Real' ? '✓ REAL' : (kpiStats.topHp2.source === 'Programación Diaria' ? '⏱️ DIARIA' : '📅 SEMANAL')}
                  </span>
                  <span className="text-slate-500 font-mono text-[9px]">({kpiStats.topHp2.fecha})</span>
                  {visibleHpLines[2] ? (
                    <Eye className="w-3.5 h-3.5 text-sky-600 ml-0.5 shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
                  )}
                </button>
              )}

              {kpiStats.topHp3.mw > 0 && (
                <button
                  type="button"
                  onClick={() => toggleHpLine(3)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
                    visibleHpLines[3]
                      ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs hover:bg-amber-100 ring-1 ring-amber-200/60'
                      : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 hover:opacity-100 line-through'
                  }`}
                  title={visibleHpLines[3] ? 'Click para borrar/ocultar la línea del 3° Pico HP' : 'Click para mostrar la línea del 3° Pico HP'}
                >
                  <span className={`w-2 h-2 rounded-full ${visibleHpLines[3] ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  <span>3° HP:</span>
                  <span className={`font-mono ${visibleHpLines[3] ? 'text-amber-700' : 'text-slate-500'}`}>
                    {kpiStats.topHp3.mw.toFixed(1)} MW
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9px] font-extrabold ${
                    !visibleHpLines[3]
                      ? 'bg-slate-200 text-slate-500'
                      : kpiStats.topHp3.source === 'Ejecutado Real'
                      ? 'bg-amber-600 text-white'
                      : kpiStats.topHp3.source === 'Programación Diaria'
                      ? 'bg-amber-300 text-amber-950'
                      : 'bg-orange-500 text-white'
                  }`}>
                    {kpiStats.topHp3.source === 'Ejecutado Real' ? '✓ REAL' : (kpiStats.topHp3.source === 'Programación Diaria' ? '⏱️ DIARIA' : '📅 SEMANAL')}
                  </span>
                  <span className="text-slate-500 font-mono text-[9px]">({kpiStats.topHp3.fecha})</span>
                  {visibleHpLines[3] ? (
                    <Eye className="w-3.5 h-3.5 text-amber-600 ml-0.5 shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Interactive Recharts Graph */}
          <div className="flex-1 w-full min-h-0 pt-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <span>Renderizando curva de demanda y picos HP/HFP...</span>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                No hay puntos disponibles para graficar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 14, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="displayLabel"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval="preserveStartEnd"
                    minTickGap={45}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(val) => `${Math.round(val)} MW`}
                    width={65}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const dataPoint = payload[0]?.payload;
                      const exec = dataPoint?.Ejecutado;
                      const daily = dataPoint?.['Programación Diaria'];
                      const weekly = dataPoint?.['Programación Semanal'];
                      const isHp = dataPoint?.isHp;

                      return (
                        <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[240px]">
                          <div className="font-mono font-bold text-slate-200 border-b border-slate-700 pb-1 flex items-center justify-between">
                            <span>{dataPoint?.rawFecha}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isHp ? 'bg-rose-500/30 text-rose-300' : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {isHp ? 'Hora Punta (HP)' : 'Fuera Punta (HFP)'}
                            </span>
                          </div>

                          <div className="space-y-1 pt-0.5">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-sky-400" />
                                Ejecutado (Real):
                              </span>
                              <span className="font-mono font-bold text-white">
                                {exec !== null ? `${exec.toLocaleString('es-PE')} MW` : 'Pendiente / Proy.'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                Prog. Diaria:
                              </span>
                              <span className="font-mono font-medium text-slate-200">
                                {daily !== null ? `${daily.toLocaleString('es-PE')} MW` : '—'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-orange-400">
                                <span className="w-2 h-2 rounded-full bg-orange-400" />
                                Prog. Semanal:
                              </span>
                              <span className="font-mono font-medium text-slate-200">
                                {weekly !== null ? `${weekly.toLocaleString('es-PE')} MW` : '—'}
                              </span>
                            </div>

                            {exec !== null && daily !== null && (
                              <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                                <span>Desviación Real vs Diario:</span>
                                <span className={`font-mono font-semibold ${daily - exec > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {(daily - exec > 0 ? '+' : '') + (daily - exec).toFixed(1)} MW ({(((daily - exec) / exec) * 100).toFixed(2)}%)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* REFERENCE LINE 1: 1° PICO HORA PUNTA (HP) */}
                  {visibleHpLines[1] && kpiStats.topHp1.mw > 0 && (
                    <ReferenceLine
                      y={kpiStats.topHp1.mw}
                      stroke="#e11d48"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{
                        value: `1° Pico HP: ${Math.round(kpiStats.topHp1.mw)} MW • [${kpiStats.topHp1.source}] • ${kpiStats.topHp1.fecha}`,
                        position: 'top',
                        fill: '#be123c',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    />
                  )}

                  {/* REFERENCE LINE 2: 2° PICO HORA PUNTA (HP) */}
                  {visibleHpLines[2] && kpiStats.topHp2.mw > 0 && (
                    <ReferenceLine
                      y={kpiStats.topHp2.mw}
                      stroke="#0284c7"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{
                        value: `2° Pico HP: ${Math.round(kpiStats.topHp2.mw)} MW • [${kpiStats.topHp2.source}] • ${kpiStats.topHp2.fecha}`,
                        position: 'bottom',
                        fill: '#0369a1',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    />
                  )}

                  {/* REFERENCE LINE 3: 3° PICO HORA PUNTA (HP) */}
                  {visibleHpLines[3] && kpiStats.topHp3.mw > 0 && (
                    <ReferenceLine
                      y={kpiStats.topHp3.mw}
                      stroke="#d97706"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      label={{
                        value: `3° Pico HP: ${Math.round(kpiStats.topHp3.mw)} MW • [${kpiStats.topHp3.source}] • ${kpiStats.topHp3.fecha}`,
                        position: 'top',
                        fill: '#b45309',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    />
                  )}

                  {/* Series 1: Ejecutado (Solid Blue / Sky) */}
                  <Line
                    type="monotone"
                    dataKey="Ejecutado"
                    stroke="#33B8FF"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2, fill: '#33B8FF' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />

                  {/* Series 2: Programación Diaria (Dotted Teal / Mint) */}
                  <Line
                    type="monotone"
                    dataKey="Programación Diaria"
                    stroke="#3DD19D"
                    strokeWidth={1.8}
                    strokeDasharray="3 3"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2, fill: '#3DD19D' }}
                    isAnimationActive={false}
                    connectNulls={true}
                  />

                  {/* Series 3: Programación Semanal (Dotted Orange) */}
                  <Line
                    type="monotone"
                    dataKey="Programación Semanal"
                    stroke="#FF7A33"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2, fill: '#FF7A33' }}
                    isAnimationActive={false}
                    connectNulls={true}
                  />

                  {/* Bottom Dynamic Ruler (Brush) */}
                  <Brush
                    dataKey="displayLabel"
                    height={32}
                    stroke="#2563eb"
                    fill="#f1f5f9"
                    travellerWidth={14}
                    startIndex={brushRange?.startIndex}
                    endIndex={brushRange?.endIndex}
                    onChange={handleBrushChange}
                    tickFormatter={(tick) => String(tick)}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom Dynamic Ruler Helper & Active Window Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 px-1 text-[11px] text-slate-500 border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold text-slate-700">Regla de rango dinámico:</span>
              <span>Desliza las barras laterales para reducir el tiempo de muestreo (ver horas o días específicos).</span>
            </div>
            {activeVisibleRange && (
              <div className="flex items-center gap-2 font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Muestreo visible: <strong>{activeVisibleRange.count} intervalos</strong> ({activeVisibleRange.hours}h / {activeVisibleRange.days}d)</span>
                <span className="text-slate-400">({activeVisibleRange.startLabel} — {activeVisibleRange.endLabel})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Technical Explanatory Note on HP and HFP according to Peruvian Regulatory Framework */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span>Definición Regulatoria de Horas Punta (HP) y Fuera de Punta (HFP) en el SEIN</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="font-semibold text-rose-900 block mb-1">🔴 Hora Punta (HP: 18:00 a 23:00 hrs)</span>
            Periodo de máxima exigencia térmica e hidráulica del sistema eléctrico nacional. La potencia coincidente registrada durante estas horas determina la potencia de facturación mensual para usuarios libres y distribuidores según resoluciones de OSINERGMIN.
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="font-semibold text-sky-900 block mb-1">🔵 Fuera de Punta (HFP: 00:00 a 18:00 y 23:00 a 24:00)</span>
            Periodo de carga base y media. El pico diurno suele presentarse entre las 11:00 y las 14:00 hrs debido a la demanda comercial e industrial. No impacta en la tarifa por potencia coincidente en horas de punta.
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="font-semibold text-amber-900 block mb-1">⚡ Alerta Predictiva de Demanda Récord</span>
            Si la Programación Diaria (RDO) o Semanal (SPO) del COES proyecta que hoy se superará la máxima demanda del mes en curso, el sistema eleva de inmediato la alerta visual para habilitar protocolos de gestión de demanda y grupos electrógenos.
          </div>
        </div>
      </div>

      {/* Sync History Modal */}
      <CoesSyncHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={syncHistory}
      />
    </div>
  );
};
