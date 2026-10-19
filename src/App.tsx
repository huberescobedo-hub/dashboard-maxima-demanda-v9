import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PEAK_DEMAND_RECORDS, 
  calculateSystemStats,
  MONTH_NAMES,
  createPeakRecordFromInput,
  combineAndRecalculateRecords,
  CustomPeakInput
} from './data/demandData';
import { REGIONS_METADATA } from './data/regions';
import { FilterState, PeakDemandRecord, AllRegionKey } from './types';
import { Header } from './components/Header';
import { FiltersBar } from './components/FiltersBar';
import { KpiMetrics } from './components/KpiMetrics';
import { DemandTrendChart } from './components/DemandTrendChart';
import { SeasonalHeatmap } from './components/SeasonalHeatmap';
import { RegionalBreakdownChart } from './components/RegionalBreakdownChart';
import { TemporalAnalysis } from './components/TemporalAnalysis';
import { DataTable } from './components/DataTable';
import { RecordModal } from './components/RecordModal';
import { TechnicalGuideModal } from './components/TechnicalGuideModal';
import { AddPeakRecordModal } from './components/AddPeakRecordModal';
import { CoesLiveDemandView } from './components/CoesLiveDemandView';
import { ArrowRight, TrendingUp } from 'lucide-react';


const INITIAL_FILTERS: FilterState = {
  region: 'nacional',
  startYear: 2010,
  endYear: 2026,
  months: [],
  daysOfWeek: [],
  timeSlot: 'all',
  minMW: 0,
  maxMW: 10000,
  searchQuery: '',
};

const REQUIRED_PASSWORD = 'BMSRP2026';

function broadcastUpdate(records: PeakDemandRecord[]) {
  try {
    const channel = new BroadcastChannel('coes_records_sync_channel');
    channel.postMessage({ type: 'RECORDS_UPDATED', records });
    channel.close();
  } catch (e) {}
}

export default function App() {
  const [activeView, setActiveView] = useState<'historical' | 'coes_live'>('historical');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedRecord, setSelectedRecord] = useState<PeakDemandRecord | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);


  // Custom User Records persisted both in LocalStorage (instant cache) & Backend Server (disk persistence)
  const [customRecords, setCustomRecords] = useState<PeakDemandRecord[]>(() => {
    try {
      const saved = localStorage.getItem('coes_user_custom_records');
      if (!saved) return [];
      const parsed: PeakDemandRecord[] = JSON.parse(saved);
      // Clean out obsolete draft for 2026-09 now that it is officially recorded in the COES dataset
      const cleaned = Array.isArray(parsed) ? parsed.filter((r) => r.id !== '2026-09') : [];
      if (cleaned.length !== parsed.length) {
        localStorage.setItem('coes_user_custom_records', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  // On mount: fetch persistent records from backend server and setup cross-tab synchronization
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch from server API (with strict content-type check to prevent HTML parsing errors on GitHub Pages)
    fetch('/api/custom-records')
      .then((res) => {
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) return res.json();
        throw new Error('Servidor API no disponible (modo estático)');
      })
      .then((data) => {
        if (!isMounted) return;
        const serverRecords: PeakDemandRecord[] = Array.isArray(data?.records)
          ? data.records.filter((r: any) => r.id !== '2026-09')
          : [];

        setCustomRecords((localPrev) => {
          // Merge server records with any local records
          const map = new Map<string, PeakDemandRecord>();
          localPrev.filter((r) => r.id !== '2026-09').forEach((r) => map.set(r.id, r));
          serverRecords.forEach((r) => map.set(r.id, r));

          const unified = Array.from(map.values());
          try {
            localStorage.setItem('coes_user_custom_records', JSON.stringify(unified));
          } catch (e) {}

          // If there were local records not yet stored on server, sync them
          localPrev
            .filter((r) => r.id !== '2026-09')
            .forEach((lr) => {
              if (!serverRecords.some((sr) => sr.id === lr.id)) {
                fetch('/api/custom-records', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: REQUIRED_PASSWORD, record: lr }),
                }).catch(() => {});
              }
            });

          return unified;
        });
      })
      .catch((err) => {
        // Fallback: check static public/data/custom_records.json if available
        const baseUrl = import.meta.env.BASE_URL || '/';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        fetch(`${cleanBase}data/custom_records.json`)
          .then((r) => {
            const ct = r.headers.get('content-type') || '';
            if (r.ok && ct.includes('application/json')) return r.json();
            return [];
          })
          .then((staticRecs) => {
            if (Array.isArray(staticRecs) && staticRecs.length > 0) {
              setCustomRecords((prev) => {
                const map = new Map<string, PeakDemandRecord>();
                staticRecs.forEach((r: any) => map.set(r.id, r));
                prev.forEach((r) => map.set(r.id, r));
                return Array.from(map.values());
              });
            }
          })
          .catch(() => {});
        console.warn('Usando almacenamiento local offline para registros:', err.message);
      });

    // 2. Cross-tab live synchronization via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('coes_records_sync_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'RECORDS_UPDATED' && Array.isArray(event.data.records)) {
          setCustomRecords(event.data.records);
        }
      };
    } catch (e) {}

    // 3. Storage event fallback for older browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'coes_user_custom_records' && e.newValue) {
        try {
          setCustomRecords(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Combine static official records with user-added entries and recalculate YoY & ranks
  const allRecords = useMemo(() => {
    return combineAndRecalculateRecords(PEAK_DEMAND_RECORDS, customRecords);
  }, [customRecords]);

  // Maximum year present in the dataset (e.g. 2026, 2027)
  const maxAvailableYear = useMemo(() => {
    return Math.max(2026, ...allRecords.map((r) => r.year));
  }, [allRecords]);

  // Dynamically expand endYear filter ONLY when a newer year is introduced to the dataset
  const prevMaxYearRef = React.useRef(maxAvailableYear);
  useEffect(() => {
    if (maxAvailableYear > prevMaxYearRef.current) {
      setFilters((prev) => ({
        ...prev,
        endYear: maxAvailableYear,
      }));
      prevMaxYearRef.current = maxAvailableYear;
    }
  }, [maxAvailableYear]);

  // Filter application across the unified records
  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      // 1. Year range
      if (rec.year < filters.startYear || rec.year > filters.endYear) {
        return false;
      }

      // 2. Months
      if (filters.months.length > 0 && !filters.months.includes(rec.month)) {
        return false;
      }

      // 3. Day of week
      if (filters.daysOfWeek.length > 0 && !filters.daysOfWeek.includes(rec.dayOfWeek)) {
        return false;
      }

      // 4. Time slot
      if (filters.timeSlot === 'hp' && !rec.isPeakHour) {
        return false;
      }
      if (filters.timeSlot === '19_20' && rec.hour !== 19) {
        return false;
      }
      if (filters.timeSlot === '20_21' && rec.hour !== 20) {
        return false;
      }

      // 5. Search query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchesDate = rec.date.includes(q);
        const matchesMonth = rec.monthName.toLowerCase().includes(q);
        const matchesDay = rec.dayOfWeek.toLowerCase().includes(q);
        const matchesTime = rec.time.includes(q);
        const matchesNotes = rec.notes.toLowerCase().includes(q);
        const matchesYear = String(rec.year).includes(q);
        if (!matchesDate && !matchesMonth && !matchesDay && !matchesTime && !matchesNotes && !matchesYear) {
          return false;
        }
      }

      return true;
    });
  }, [allRecords, filters]);

  // Compute stats for current filtered selection and active region
  const stats = useMemo(() => {
    return calculateSystemStats(filteredRecords, filters.region);
  }, [filteredRecords, filters.region]);

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const handleSelectRegion = useCallback((region: AllRegionKey) => {
    setFilters((prev) => ({ ...prev, region }));
  }, []);

  // Save new peak record entered by user
  const handleSaveCustomRecord = useCallback((input: CustomPeakInput) => {
    const newRecord = createPeakRecordFromInput(input);
    setCustomRecords((prev) => {
      // If same month id exists, replace it, otherwise append
      const filtered = prev.filter((r) => r.id !== newRecord.id);
      const updated = [...filtered, newRecord];
      try {
        localStorage.setItem('coes_user_custom_records', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving custom records', e);
      }
      broadcastUpdate(updated);
      return updated;
    });

    // Persist to backend server API
    fetch('/api/custom-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: REQUIRED_PASSWORD,
        record: newRecord,
      }),
    }).catch((err) => {
      console.error('Error saving record to server:', err);
    });

    // Automatically expand the year filter if the new date is beyond the current range
    if (newRecord.year > filters.endYear) {
      setFilters((f) => ({ ...f, endYear: newRecord.year }));
    }
    if (newRecord.year < filters.startYear) {
      setFilters((f) => ({ ...f, startYear: newRecord.year }));
    }
  }, [filters.endYear, filters.startYear]);

  // Delete a user-added record
  const handleDeleteCustomRecord = useCallback((id: string) => {
    setCustomRecords((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem('coes_user_custom_records', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving custom records', e);
      }
      broadcastUpdate(updated);
      return updated;
    });

    // Persist deletion to backend server API
    fetch(`/api/custom-records/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: REQUIRED_PASSWORD }),
    }).catch((err) => {
      console.error('Error deleting record on server:', err);
    });
  }, []);

  // Clear all custom records
  const handleClearAllCustom = useCallback(() => {
    if (window.confirm('¿Deseas eliminar todos los registros digitados y volver a la serie histórica original del COES?')) {
      setCustomRecords([]);
      try {
        localStorage.removeItem('coes_user_custom_records');
      } catch (e) {}
      broadcastUpdate([]);

      // Persist clear to backend server API
      fetch('/api/custom-records/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: REQUIRED_PASSWORD }),
      }).catch((err) => {
        console.error('Error clearing records on server:', err);
      });
    }
  }, []);

  // Latest record for reference in modal
  const latestRecord = useMemo(() => {
    if (allRecords.length === 0) return undefined;
    return allRecords[allRecords.length - 1];
  }, [allRecords]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const regionKey = filters.region;
    const regionName = REGIONS_METADATA[regionKey].shortName;
    
    const headers = [
      'Año',
      'Mes_Numero',
      'Mes_Nombre',
      'Dia_Del_Mes',
      'Fecha_Completa',
      'Dia_De_Semana',
      'Tipo_Dia',
      'Hora_Especifica',
      'Bloque_Horario',
      `Demanda_${regionName}_MW`,
      'Demanda_Nacional_SEIN_MW',
      'Exportacion_PER_ECU_MW',
      'Importacion_ECU_PER_MW',
      'Participacion_Porcentaje',
      'Crecimiento_YoY_Porcentaje',
      'Ranking_Historico_SEIN',
      'Tipo_Fuente',
      'Observaciones_COES'
    ];

    const rows = filteredRecords.map((r) => {
      const regPoint = r.regions[regionKey];
      return [
        r.year,
        r.month,
        `"${r.monthName}"`,
        r.day,
        r.date,
        `"${r.dayOfWeek}"`,
        `"${r.dayType}"`,
        r.time,
        `"${r.periodName}"`,
        regPoint ? regPoint.demandMW : r.nationalDemandMW,
        r.nationalDemandMW,
        r.exportEcuMW ?? 0,
        r.importEcuMW ?? 0,
        regPoint ? regPoint.sharePercentage : 100,
        r.growthYoY !== null ? r.growthYoY : '',
        r.rankHistoric,
        r.isUserAdded ? '"Digitado Manualmente"' : '"Validado COES"',
        `"${r.notes.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `maxima_demanda_peru_${regionKey}_${filters.startYear}_${filters.endYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredRecords, filters.region, filters.startYear, filters.endYear]);

  // Export to JSON
  const handleExportJSON = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredRecords, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `maxima_demanda_peru_${filters.region}_2010_${maxAvailableYear}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [filteredRecords, filters.region, maxAvailableYear]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation & App Header */}
      <Header
        currentRegion={filters.region}
        totalFilteredRecords={filteredRecords.length}
        totalRecordsCount={allRecords.length}
        customRecordsCount={customRecords.length}
        activeView={activeView}
        onSelectView={setActiveView}
        onResetFilters={handleResetFilters}
        onOpenHelp={() => setIsHelpOpen(true)}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        onOpenAddRecord={() => setIsAddModalOpen(true)}
      />

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeView === 'coes_live' ? (
          /* Live COES Demand & Daily/Weekly Projections Module */
          <CoesLiveDemandView />
        ) : (
          /* 15-Year Historical Peak Demand Analysis System */
          <>
            {/* Quick Access Banner to Live COES Projections */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-4 sm:p-5 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-blue-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-sky-400 shrink-0">
                  <TrendingUp className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/30 text-sky-300 border border-blue-400/30">
                      Módulo en Tiempo Real
                    </span>
                    <span className="text-xs text-blue-200">Portal Oficial COES • Interconexión SEIN</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
                    Proyección Diaria y Semanal vs. Demanda Ejecutada Real
                  </h3>
                  <p className="text-xs text-slate-300">
                    Alimentado directamente desde el portal web del COES con actualización automática a las 8:00 AM y consulta por rango de fechas (ej: 01/10/2026 al 30/10/2026).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('coes_live')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-center shrink-0"
              >
                <span>Ver Proyecciones COES</span>
                <ArrowRight className="w-4 h-4 text-blue-600" />
              </button>
            </div>

            {/* Interactive Filtering Module (Region, Years, Months, Days, Time, Search) */}
            <FiltersBar
              filters={filters}
              onChangeFilters={setFilters}
              onReset={handleResetFilters}
              totalResults={filteredRecords.length}
              maxYear={maxAvailableYear}
            />

            {/* 5 Core Metric Cards */}
            <KpiMetrics
              stats={stats}
              currentRegion={filters.region}
              onInspectRecord={setSelectedRecord}
            />

            {/* Análisis de Ocurrencia Temporal (Horas, Días, Meses y Semanas) */}
            <TemporalAnalysis
              records={filteredRecords}
              currentRegion={filters.region}
            />

            {/* Main 15-Year Historical Evolution Chart */}
            <DemandTrendChart
              records={filteredRecords}
              currentRegion={filters.region}
              onSelectRecord={setSelectedRecord}
            />

            {/* 15 Years x 12 Months Heatmap Matrix */}
            <SeasonalHeatmap
              records={filteredRecords}
              currentRegion={filters.region}
              onSelectRecord={setSelectedRecord}
            />

            {/* Distribución y Aporte por Regiones Eléctricas */}
            <RegionalBreakdownChart
              records={filteredRecords}
              currentRegion={filters.region}
              onSelectRegion={handleSelectRegion}
            />

            {/* Comprehensive Data Table with Search, Sort, and CSV Export */}
            <DataTable
              records={filteredRecords}
              currentRegion={filters.region}
              onSelectRecord={setSelectedRecord}
              onExportCSV={handleExportCSV}
              onOpenAddRecord={() => setIsAddModalOpen(true)}
              onDeleteRecord={handleDeleteCustomRecord}
            />
          </>
        )}
      </main>

      {/* Footer with Operational Data References */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">COES - SEIN</span>
            <span>•</span>
            <span>Comité de Operación Económica del Sistema Interconectado Nacional del Perú</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Período: 2010 - {maxAvailableYear}</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="text-amber-700 hover:underline cursor-pointer font-medium"
            >
              Marco Metodológico
            </button>
          </div>
        </div>
      </footer>

      {/* Detailed Record Inspector Modal */}
      <RecordModal
        record={selectedRecord}
        currentRegion={filters.region}
        onClose={() => setSelectedRecord(null)}
        onSelectRegion={handleSelectRegion}
        onDeleteRecord={handleDeleteCustomRecord}
      />

      {/* Regulatory & COES Guide Modal */}
      <TechnicalGuideModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Modal para digitar las siguientes fechas de Máxima Demanda */}
      <AddPeakRecordModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaveRecord={handleSaveCustomRecord}
        customRecords={customRecords}
        onDeleteCustomRecord={handleDeleteCustomRecord}
        onClearAllCustom={handleClearAllCustom}
        latestRecord={latestRecord}
      />
    </div>
  );
}
