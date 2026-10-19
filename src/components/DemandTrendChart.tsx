import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Brush,
} from 'recharts';
import { TrendingUp, BarChart3, Clock, Calendar, Zap, Maximize2, SlidersHorizontal, RotateCcw, Filter } from 'lucide-react';
import { PeakDemandRecord, AllRegionKey } from '../types';
import { REGIONS_METADATA } from '../data/regions';

interface DemandTrendChartProps {
  records: PeakDemandRecord[];
  currentRegion: AllRegionKey;
  onSelectRecord: (record: PeakDemandRecord) => void;
}

type ChartViewMode = 'monthly' | 'annualPeak' | 'growthYoY';

export const DemandTrendChart: React.FC<DemandTrendChartProps> = ({
  records,
  currentRegion,
  onSelectRecord,
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('monthly');
  // Dynamic Brush / Ruler range state
  const [brushRange, setBrushRange] = useState<{ startIndex?: number; endIndex?: number }>({});

  const regionInfo = REGIONS_METADATA[currentRegion];

  // Prepare data based on selected view mode
  const getRecordMW = (r: PeakDemandRecord) =>
    r.regions[currentRegion]?.demandMW ?? r.nationalDemandMW;

  let chartData: any[] = [];

  if (viewMode === 'monthly') {
    chartData = records.map((r) => ({
      id: r.id,
      label: `${r.monthName.slice(0, 3)} ${r.year}`,
      date: r.date,
      year: r.year,
      month: r.month,
      monthName: r.monthName,
      day: r.day,
      dayOfWeek: r.dayOfWeek,
      time: r.time,
      demandMW: getRecordMW(r),
      nationalDemandMW: r.nationalDemandMW,
      growthYoY: r.growthYoY,
      notes: r.notes,
      rawRecord: r,
    }));
  } else if (viewMode === 'annualPeak') {
    // Group by year and pick the max demand month of each year
    const byYearMap = new Map<number, PeakDemandRecord>();
    records.forEach((r) => {
      const existing = byYearMap.get(r.year);
      if (!existing || getRecordMW(r) > getRecordMW(existing)) {
        byYearMap.set(r.year, r);
      }
    });

    chartData = Array.from(byYearMap.values())
      .sort((a, b) => a.year - b.year)
      .map((r) => ({
        id: `peak-${r.year}`,
        label: `${r.year}`,
        date: r.date,
        year: r.year,
        monthName: r.monthName,
        day: r.day,
        dayOfWeek: r.dayOfWeek,
        time: r.time,
        demandMW: getRecordMW(r),
        nationalDemandMW: r.nationalDemandMW,
        growthYoY: r.growthYoY,
        notes: r.notes,
        rawRecord: r,
      }));
  } else {
    // YoY Growth View
    chartData = records
      .filter((r) => r.growthYoY !== null)
      .map((r) => ({
        id: r.id,
        label: `${r.monthName.slice(0, 3)} ${r.year}`,
        date: r.date,
        year: r.year,
        monthName: r.monthName,
        day: r.day,
        dayOfWeek: r.dayOfWeek,
        time: r.time,
        growthYoY: r.growthYoY,
        demandMW: getRecordMW(r),
        notes: r.notes,
        rawRecord: r,
      }));
  }

  // Reset ruler when view mode or current region or records count changes
  useEffect(() => {
    setBrushRange({});
  }, [viewMode, currentRegion, records.length]);

  // Handler for presets (e.g. 1 Año, 3 Años, 5 Años, Todo)
  const applyRangePreset = (preset: '1Y' | '3Y' | '5Y' | 'ALL') => {
    if (!chartData.length) return;
    const total = chartData.length;
    if (preset === '1Y') {
      const stepCount = viewMode === 'annualPeak' ? 2 : 12;
      const start = Math.max(0, total - stepCount);
      setBrushRange({ startIndex: start, endIndex: total - 1 });
    } else if (preset === '3Y') {
      const stepCount = viewMode === 'annualPeak' ? 3 : 36;
      const start = Math.max(0, total - stepCount);
      setBrushRange({ startIndex: start, endIndex: total - 1 });
    } else if (preset === '5Y') {
      const stepCount = viewMode === 'annualPeak' ? 5 : 60;
      const start = Math.max(0, total - stepCount);
      setBrushRange({ startIndex: start, endIndex: total - 1 });
    } else {
      setBrushRange({ startIndex: 0, endIndex: total - 1 });
    }
  };

  // Active sampled range details from the ruler
  const activeSampleDetails = useMemo(() => {
    if (!chartData.length) return null;
    const startIdx = Math.max(0, Math.min(chartData.length - 1, brushRange.startIndex ?? 0));
    const endIdx = Math.max(0, Math.min(chartData.length - 1, brushRange.endIndex ?? (chartData.length - 1)));
    const startPoint = chartData[startIdx];
    const endPoint = chartData[endIdx];
    const count = Math.max(1, endIdx - startIdx + 1);
    const isFiltered = brushRange.startIndex !== undefined || brushRange.endIndex !== undefined;

    return {
      startIdx,
      endIdx,
      startLabel: startPoint?.label || '',
      endLabel: endPoint?.label || '',
      count,
      totalCount: chartData.length,
      isFiltered,
    };
  }, [chartData, brushRange]);

  // Calculate min, max for YAxis domain
  const values = chartData.map((d) => (viewMode === 'growthYoY' ? d.growthYoY : d.demandMW));
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 1000;

  const yDomain =
    viewMode === 'growthYoY'
      ? [Math.floor(minVal - 2), Math.ceil(maxVal + 2)]
      : [Math.floor((minVal * 0.9) / 100) * 100, Math.ceil((maxVal * 1.05) / 100) * 100];

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const rec: PeakDemandRecord = data.rawRecord;

    return (
      <div className="bg-slate-900 text-white rounded-xl shadow-xl p-3.5 border border-slate-700 text-xs max-w-xs space-y-2 z-50">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-amber-400">
            {rec.monthName} {rec.year}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
            {regionInfo.shortName}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Máxima Demanda:</span>
            <span className="font-extrabold text-sm text-white">
              {data.demandMW.toLocaleString('es-PE')} MW
            </span>
          </div>
          {currentRegion !== 'nacional' && (
            <div className="flex items-center justify-between text-slate-400">
              <span>SEIN Nacional:</span>
              <span className="font-semibold text-slate-200">
                {rec.nationalDemandMW.toLocaleString('es-PE')} MW
              </span>
            </div>
          )}
          {rec.growthYoY !== null && (
            <div className="flex items-center justify-between text-slate-400">
              <span>Crecimiento Interanual (YoY):</span>
              <span
                className={`font-semibold ${
                  rec.growthYoY >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {rec.growthYoY > 0 ? `+${rec.growthYoY}%` : `${rec.growthYoY}%`}
              </span>
            </div>
          )}
        </div>

        <div className="pt-1.5 border-t border-slate-800/80 text-[11px] text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>
              {rec.dayOfWeek} {rec.day} de {rec.monthName} de {rec.year}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>
              Hora específica:{' '}
              <strong className="text-amber-300 font-bold">{rec.time} hrs</strong> ({rec.periodName})
            </span>
          </div>
        </div>

        {rec.notes && (
          <p className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 italic">
            "{rec.notes}"
          </p>
        )}

        <div className="text-[10px] text-amber-400 font-medium text-center pt-1">
          Click para ver ficha técnica completa
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Evolución Histórica de la Máxima Demanda
            </h2>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${regionInfo.color}15`, color: regionInfo.color }}
            >
              {regionInfo.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro de la potencia máxima coincidente con día de semana y hora de ocurrencia
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              viewMode === 'monthly'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Evolución Mensual
          </button>
          <button
            type="button"
            onClick={() => setViewMode('annualPeak')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              viewMode === 'annualPeak'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Picos Anuales (Récords)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('growthYoY')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              viewMode === 'growthYoY'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Variación YoY %
          </button>
        </div>
      </div>

      {/* Dynamic Range Presets and Ruler Info Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>Filtro de Rango Dinámico:</span>
          </div>

          <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => applyRangePreset('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                !activeSampleDetails?.isFiltered
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Todo ({chartData.length} pts)
            </button>
            <button
              type="button"
              onClick={() => applyRangePreset('5Y')}
              className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              5 Años
            </button>
            <button
              type="button"
              onClick={() => applyRangePreset('3Y')}
              className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              3 Años
            </button>
            <button
              type="button"
              onClick={() => applyRangePreset('1Y')}
              className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Último Año
            </button>
          </div>

          {activeSampleDetails?.isFiltered && (
            <button
              type="button"
              onClick={() => setBrushRange({})}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-rose-700 bg-white border border-slate-200 hover:border-rose-200 rounded-md shadow-2xs transition-all cursor-pointer"
              title="Restablecer regla al rango completo"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Restablecer</span>
            </button>
          )}
        </div>

        {/* Live Window Indicator */}
        {activeSampleDetails && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200/80 shadow-2xs self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-800">Muestreo activo:</span>
            <span className="text-blue-700 font-bold">{activeSampleDetails.count} registros</span>
            <span className="text-slate-400">({activeSampleDetails.startLabel} — {activeSampleDetails.endLabel})</span>
          </div>
        )}
      </div>

      {/* Main Chart Container */}
      <div className="h-80 sm:h-96 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            No hay registros que coincidan con los filtros seleccionados.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  onSelectRecord(e.activePayload[0].payload.rawRecord);
                }
              }}
              margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={regionInfo.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={regionInfo.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fill: '#64748b', fontSize: 11 }}
                interval={viewMode === 'annualPeak' ? 0 : Math.ceil(chartData.length / 12)}
              />
              <YAxis
                domain={yDomain}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(val) =>
                  viewMode === 'growthYoY' ? `${val}%` : `${val.toLocaleString()} MW`
                }
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />

              {viewMode === 'growthYoY' ? (
                <>
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
                  <Bar
                    dataKey="growthYoY"
                    name="Crecimiento YoY"
                    fill={regionInfo.color}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                  />
                </>
              ) : (
                <>
                  {currentRegion === 'nacional' && (
                    <>
                      <ReferenceLine
                        y={8000}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Hito 8,000 MW (2025)',
                          position: 'insideTopLeft',
                          fill: '#d97706',
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      />
                      <ReferenceLine
                        y={7000}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{
                          value: '7,000 MW (2018)',
                          position: 'insideBottomLeft',
                          fill: '#64748b',
                          fontSize: 10,
                        }}
                      />
                    </>
                  )}
                  <Area
                    type="monotone"
                    dataKey="demandMW"
                    stroke={regionInfo.color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#demandGradient)"
                    activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: regionInfo.color }}
                    cursor="pointer"
                  />
                  <Line
                    type="monotone"
                    dataKey="demandMW"
                    stroke={regionInfo.color}
                    strokeWidth={2.5}
                    dot={
                      viewMode === 'annualPeak'
                        ? { r: 4, stroke: '#ffffff', strokeWidth: 2, fill: regionInfo.color }
                        : false
                    }
                  />
                </>
              )}

              {/* Dynamic Ruler (Brush): Draggable handles to reduce time sampling */}
              {chartData.length > 4 && (
                <Brush
                  dataKey="label"
                  height={32}
                  stroke={regionInfo.color}
                  fill="#f8fafc"
                  travellerWidth={14}
                  startIndex={brushRange.startIndex}
                  endIndex={brushRange.endIndex}
                  onChange={(range: any) => {
                    if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number') {
                      setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
                    }
                  }}
                  tickFormatter={(tick) => String(tick)}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart Footer Indicator */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: regionInfo.color }} />
          <span>Línea de Potencia Máxima en Megavatios (MW)</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-700 font-medium">
            📏 Mueve las barras de la regla inferior para reducir el muestreo y visualizar rangos más pequeños
          </span>
        </div>
        <div className="text-slate-500">
          Haz click en cualquier punto para inspeccionar el evento de pico
        </div>
      </div>
    </div>
  );
};
