import React from 'react';
import { X, History, CheckCircle2, AlertTriangle, Calendar, Clock, Database, ArrowUpRight } from 'lucide-react';
import { CoesSyncHistoryItem } from '../types';

interface CoesSyncHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: CoesSyncHistoryItem[];
  onLoadSnapshot?: (item: CoesSyncHistoryItem) => void;
}

export const CoesSyncHistoryModal: React.FC<CoesSyncHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onLoadSnapshot,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Historial de Sincronizaciones y Evolutivo COES</h2>
              <p className="text-xs text-slate-300">
                Registro cronológico de consultas automáticas (8:00 AM) y manuales con sus picos guardados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Actualización Automática Diaria:</span> El servidor ejecuta automáticamente la lectura de demanda del portal COES todos los días a las <strong>08:00 AM (hora peruana)</strong>. Cada ejecución guarda una instantánea histórica permanente para analizar la evolución entre la demanda ejecutada y las proyecciones.
            </div>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <Database className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Aún no hay registros en el historial evolutivo</p>
              <p className="text-xs text-slate-400 mt-1">
                Presione &quot;Consultar&quot; o &quot;Sincronizar Ahora&quot; para registrar la primera instantánea.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Fecha / Hora Sync</th>
                    <th className="px-3 py-3">Tipo / Disparador</th>
                    <th className="px-3 py-3">Rango Consultado</th>
                    <th className="px-3 py-3 text-right">Pico Ejecutado</th>
                    <th className="px-3 py-3 text-right">Prog. Diaria Máx</th>
                    <th className="px-3 py-3 text-right">Prog. Semanal Máx</th>
                    <th className="px-3 py-3 text-center">Puntos</th>
                    <th className="px-3 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item, idx) => {
                    const dateObj = new Date(item.timestamp);
                    const formattedDate = dateObj.toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });
                    const formattedTime = dateObj.toLocaleTimeString('es-PE', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    const isAuto8am = item.trigger === 'auto-daily-8am';

                    return (
                      <tr 
                        key={`${item.timestamp}-${idx}`}
                        className={`hover:bg-slate-50 transition-colors ${
                          isAuto8am ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formattedDate}</span>
                            <span className="text-slate-400">{formattedTime}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {isAuto8am ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Auto 08:00 am
                            </span>
                          ) : item.trigger === 'manual' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              Manual
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              Consulta Web
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-600">
                          {item.fechaInicial} &rarr; {item.fechaFinal}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-blue-700">
                          {item.peakExecutedMW ? `${item.peakExecutedMW.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW` : '—'}
                          {item.peakExecutedDate && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              {item.peakExecutedDate.split(' ')[0]}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium text-emerald-700">
                          {item.peakProgDiariaMW ? `${item.peakProgDiariaMW.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium text-orange-700">
                          {item.peakProgSemanalMW ? `${item.peakProgSemanalMW.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW` : '—'}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-slate-600">
                          {item.pointsCount}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {item.status === 'OK' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              OK (200)
                            </span>
                          ) : item.status === 'CACHE_FALLBACK' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Caché
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              Error
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            Total de instantáneas guardadas: <strong>{history.length}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
