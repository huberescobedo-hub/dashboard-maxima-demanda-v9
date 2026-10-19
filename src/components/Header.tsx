import React from 'react';
import { Zap, Download, RefreshCw, HelpCircle, FileSpreadsheet, CalendarPlus, BarChart3, TrendingUp } from 'lucide-react';
import { AllRegionKey } from '../types';

import { REGIONS_METADATA } from '../data/regions';

interface HeaderProps {
  currentRegion: AllRegionKey;
  totalFilteredRecords: number;
  totalRecordsCount: number;
  customRecordsCount: number;
  activeView: 'historical' | 'coes_live';
  onSelectView: (view: 'historical' | 'coes_live') => void;
  onResetFilters: () => void;
  onOpenHelp: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onOpenAddRecord: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRegion,
  totalFilteredRecords,
  totalRecordsCount,
  customRecordsCount,
  activeView,
  onSelectView,
  onResetFilters,
  onOpenHelp,
  onExportCSV,
  onExportJSON,
  onOpenAddRecord,
}) => {
  const regionInfo = REGIONS_METADATA[currentRegion];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3.5 pb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Brand & Title */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 fill-amber-500 text-amber-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  COES • SEIN PERÚ
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  ✓ Validado COES
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  2010 - 2026 (A la fecha)
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  {totalRecordsCount} Meses Consolidados
                </span>
                {customRecordsCount > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                    +{customRecordsCount} {customRecordsCount === 1 ? 'digitado' : 'digitados'}
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                Demanda Eléctrica en el Perú • COES SEIN
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Máxima Demanda Mensual Histórica y Monitoreo en Tiempo Real de Proyección Diaria y Semanal
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {activeView === 'historical' && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500">Región:</span>
                <span className="font-semibold text-slate-800">{regionInfo.shortName}</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: regionInfo.color }} />
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">Filtrados:</span>
                <span className="font-bold text-slate-900">{totalFilteredRecords} / {totalRecordsCount}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              {activeView === 'historical' && (
                <>
                  <button
                    type="button"
                    onClick={onOpenAddRecord}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-700 hover:to-orange-700 rounded-lg shadow-sm transition-all cursor-pointer ring-2 ring-amber-500/20 active:scale-95"
                    title="Digitar fecha y potencia de la siguiente máxima demanda eléctrica"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Digitar Pico</span>
                    {customRecordsCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 bg-white/30 rounded-full text-[10px] text-white font-extrabold">
                        {customRecordsCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onExportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Exportar a archivo CSV (Excel)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">Descargar</span> CSV
                  </button>

                  <button
                    type="button"
                    onClick={onExportJSON}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Exportar datos en formato JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    JSON
                  </button>

                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="Restablecer todos los filtros"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Restablecer</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onOpenHelp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                title="Ver metodología y conceptos COES / OSINERGMIN"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Guía</span> Metodológica
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="flex items-center gap-1 sm:gap-2 pt-1 pb-1">
          <button
            type="button"
            onClick={() => onSelectView('historical')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeView === 'historical'
                ? 'bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className={`w-4 h-4 ${activeView === 'historical' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Máxima Demanda Histórica (15 Años • 2010-2026)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
              190 meses
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('coes_live')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${
              activeView === 'coes_live'
                ? 'bg-blue-50 text-blue-900 border border-blue-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className={`w-4 h-4 ${activeView === 'coes_live' ? 'text-blue-600' : 'text-slate-400'}`} />
            <span>Proyección Diaria y Semanal COES</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Portal Oficial
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};



