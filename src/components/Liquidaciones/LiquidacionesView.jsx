import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Download, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Building, 
  AlertCircle, 
  Calendar, 
  XCircle,
  FileSpreadsheet,
  Award,
  Trash2
} from 'lucide-react';
import { generatePlanillaLiquidacionPDF } from '../../services/pdfGenerator';
import { armarLiquidacion, sesionesDelPeriodo, mesALabel } from '../../lib/liquidaciones';
import { useToast } from '../Common/Toast';

const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

import { ProBadge } from '../Common/ProBadge';

export const LiquidacionesView = ({
  obrasSociales,
  pacientes,
  turnos = [],
  liquidaciones,
  onSaveObrasSociales,
  config,
  onSaveLiquidacion,
  onUpdateLiquidacionEstado,
  onDeleteLiquidacion,
  subscription = { plan: 'free' },
  onOpenUpgradeModal
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOSId, setSelectedOSId] = useState('ioscor');
  const [mes, setMes] = useState(mesActual());
  const [observaciones, setObservaciones] = useState('');
  const [isArancelesOpen, setIsArancelesOpen] = useState(false);
  const [arancelesDraft, setArancelesDraft] = useState([]);
  const toast = useToast();

  // Estadísticas rápidas de liquidaciones
  const totalPresentado = liquidaciones
    .filter(l => l.estado === 'Presentada' || l.estado === 'Liquidada')
    .reduce((acc, curr) => acc + (curr.montoBruto || 0), 0);

  const totalCobrado = liquidaciones
    .filter(l => l.estado === 'Cobrada')
    .reduce((acc, curr) => acc + (curr.montoBruto || 0), 0);

  const getObraSocialById = (id) => obrasSociales.find(os => os.id === id);

  const previewLiq = (() => {
    const os = getObraSocialById(selectedOSId);
    if (!os) return null;
    const { detalle, totalSesiones } = sesionesDelPeriodo({ turnos, pacientes, obraSocialId: os.id, mes });
    return { os, pacientes: detalle.length, totalSesiones, monto: totalSesiones * (os.arancelSesion || 0) };
  })();

  const handleCrearPlanilla = (e) => {
    e.preventDefault();
    const res = armarLiquidacion({
      obraSocial: getObraSocialById(selectedOSId), turnos, pacientes, liquidaciones, mes, observaciones,
    });
    if (res.error) {
      toast.showError(res.error);
      return;
    }
    onSaveLiquidacion(res.liquidacion);
    toast.showSuccess(`Liquidación de ${res.liquidacion.periodo} registrada: ${res.liquidacion.cantidadSesiones} sesiones.`);
    setObservaciones('');
    setIsModalOpen(false);
  };

  const handleLiquidacionMasiva = () => {
    const creadas = [];
    const omitidas = [];
    obrasSociales.filter(os => os.id !== 'particular').forEach((os, i) => {
      const res = armarLiquidacion({
        obraSocial: os, turnos, pacientes, liquidaciones, mes,
        observaciones: `Lote automático generado para ${os.nombre}.`, idSufijo: `-${i}`,
      });
      if (res.liquidacion) {
        onSaveLiquidacion(res.liquidacion);
        creadas.push(os.sigla || os.nombre);
      } else if (!/No hay turnos/.test(res.error)) {
        omitidas.push(res.error);
      }
    });
    if (creadas.length) toast.showSuccess(`Liquidaciones de ${mesALabel(mes)} creadas: ${creadas.join(', ')}.`);
    else toast.showInfo(`No hay sesiones atendidas nuevas para liquidar en ${mesALabel(mes)}.`);
    if (omitidas.length) toast.showError(omitidas.join(' '));
  };

  const handleAbrirAranceles = () => {
    setArancelesDraft(obrasSociales.map(os => ({ ...os })));
    setIsArancelesOpen(true);
  };

  const handleGuardarAranceles = (e) => {
    e.preventDefault();
    if (onSaveObrasSociales) onSaveObrasSociales(arancelesDraft);
    toast.showSuccess('Aranceles actualizados. Las liquidaciones ya generadas conservan el arancel con el que se hicieron.');
    setIsArancelesOpen(false);
  };

  const handleDescargarPDF = (liq) => {
    const os = getObraSocialById(liq.obraSocialId);
    if (!os) return;
    const pacsOS = pacientes.filter(p => p.obraSocialId === liq.obraSocialId);
    generatePlanillaLiquidacionPDF({
      obraSocial: { ...os, arancelSesion: liq.arancelSesion || os.arancelSesion },
      periodo: liq.periodo,
      pacientes: pacsOS,
      detalle: liq.detalle,
      config,
      liquidacion: liq
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Header Liquidaciones */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-medium text-emerald-700 dark:text-emerald-300">Convenios & Liquidación</span>
          </div>
          <h2 className="font-serif text-[2.1rem] sm:text-[2.6rem] leading-[1.04] text-slate-900 dark:text-slate-50 flex items-center gap-2.5">
            <div className="hidden" aria-hidden="true">
              <FileSpreadsheet size={18} />
            </div>
            <span>Obras Sociales & Liquidaciones</span>
          </h2>
          <p className="text-[14px] text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
            Generación de planillas mensuales para presentar al Colegio de Psicólogos de Corrientes o mutuales.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button 
            onClick={() => {
              const isPro = subscription?.plan === 'pro';
              if (!isPro) {
                if (onOpenUpgradeModal) {
                  onOpenUpgradeModal('La liquidación y exportación masiva por lotes de todas las obras sociales es una función exclusiva de PsicoPlus PRO.');
                }
                return;
              }
              handleLiquidacionMasiva();
            }}
            className="btn btn-secondary text-xs flex items-center gap-1.5 shadow-xs"
            title="Generar liquidación de todas las obras sociales en 1 clic"
          >
            <span>Liquidación Masiva</span>
            {subscription?.plan !== 'pro' && <ProBadge size="xs" text="PRO" />}
          </button>

          <button 
            onClick={handleAbrirAranceles}
            className="btn btn-secondary text-xs shadow-xs"
          >
            <span>Aranceles</span>
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary text-xs shadow-sm"
          >
            <Plus size={15} />
            <span>Generar Planilla</span>
          </button>
        </div>
      </div>

      {/* 3 Cards de Estado Financiero de Obras Sociales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between group">
          <div>
            <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">En Trámite</p>
            <h3 className="text-2xl sm:text-3xl font-semibold font-display text-slate-900 dark:text-white mt-1.5 tabular-nums tracking-tight">
              ${totalPresentado.toLocaleString('es-AR')}
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Pendiente de acreditación</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
            <Clock size={18} />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl flex items-center justify-between group">
          <div>
            <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Cobrado</p>
            <h3 className="text-2xl sm:text-3xl font-semibold font-display text-slate-900 dark:text-white mt-1.5 tabular-nums tracking-tight">
              ${totalCobrado.toLocaleString('es-AR')}
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Acreditado en Banco</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl flex items-center justify-between group">
          <div>
            <p className="text-[12px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">Convenios Activos</p>
            <h3 className="text-2xl sm:text-3xl font-semibold font-display text-slate-900 dark:text-white mt-1.5 tabular-nums tracking-tight">
              {obrasSociales.filter(o => o.id !== 'particular').length} O.S.
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 font-medium">IOSCOR, OSDE, Swiss, Medifé...</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20 group-hover:scale-105 transition-transform">
            <Award size={18} />
          </div>
        </div>

      </div>

      {/* Tabla de Presentaciones / Liquidaciones */}
      <div className="glass-card p-0 rounded-2xl overflow-hidden shadow-sm border border-emerald-500/15">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Historial de Planillas Presentadas
          </h3>
        </div>

        {liquidaciones.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <FileText size={32} className="mx-auto mb-1.5 opacity-40 text-slate-400" />
            <p className="text-xs font-medium">No hay planillas de liquidación registradas aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Obra Social</th>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4">Presentación</th>
                  <th className="py-3 px-4 text-center">Sesiones</th>
                  <th className="py-3 px-4 text-right">Monto Bruto</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {liquidaciones.map((liq) => {
                  const os = getObraSocialById(liq.obraSocialId);
                  return (
                    <tr key={liq.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {os?.nombre || 'Obra Social'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {liq.periodo}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {liq.fechaPresentacion}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                        {liq.cantidadSesiones}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                        ${liq.montoBruto.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={liq.estado}
                          onChange={(e) => onUpdateLiquidacionEstado(liq.id, e.target.value)}
                          className={`input-field py-1 px-2 text-[12px] font-semibold w-auto text-center ${
                            liq.estado === 'Cobrada' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            liq.estado === 'Liquidada' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <option value="Borrador">Borrador</option>
                          <option value="Presentada">Presentada</option>
                          <option value="Liquidada">Liquidada</option>
                          <option value="Cobrada">Cobrada</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleDescargarPDF(liq)}
                            className="btn btn-secondary text-[12px] py-1 px-2.5 gap-1"
                            title="Descargar Planilla en PDF oficial"
                          >
                            <Download size={12} />
                            <span>PDF</span>
                          </button>
                          {onDeleteLiquidacion && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Estás seguro/a de eliminar la liquidación de ${liq.periodo}?`)) {
                                  onDeleteLiquidacion(liq.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                              title="Eliminar liquidación"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Catálogo de Convenios y Aranceles */}
      <div className="card p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Convenios & Aranceles Vigentes (Colegio de Psicólogos / Directos)
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {obrasSociales.map((os) => (
            <div key={os.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <strong className="text-xs text-slate-900 dark:text-white font-semibold">{os.nombre}</strong>
                <span className="badge bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px]">
                  {os.tipo}
                </span>
              </div>
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                Arancel Sesión: ${os.arancelSesion.toLocaleString('es-AR')}
              </p>
              {os.coseguroRecomendado > 0 && (
                <p className="text-slate-600 dark:text-slate-400 text-[12px]">
                  Coseguro sugerido: ${os.coseguroRecomendado.toLocaleString('es-AR')}
                </p>
              )}
              <p className="text-[12px] text-slate-500 italic">
                {os.notasConvenio}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: GENERAR NUEVA PLANILLA */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="card max-w-md w-full p-5 sm:p-6 shadow-[var(--shadow-hover)] space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-semibold font-display text-slate-900 dark:text-white">
                Generar Planilla de Liquidación
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={17} />
              </button>
            </div>

            <form onSubmit={handleCrearPlanilla} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Obra Social a Liquidar *</label>
                <select
                  value={selectedOSId}
                  onChange={(e) => setSelectedOSId(e.target.value)}
                  className="input-field text-xs"
                >
                  {obrasSociales.filter(o => o.id !== 'particular').map(os => (
                    <option key={os.id} value={os.id}>{os.nombre} (${(os.arancelSesion || 0).toLocaleString('es-AR')} / ses)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Período de Facturación *</label>
                <input
                  type="month"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="input-field text-xs"
                  required
                />
              </div>

              {previewLiq && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[12px] text-slate-600 dark:text-slate-300">
                  {previewLiq.totalSesiones > 0 ? (
                    <span>
                      {mesALabel(mes)}: <b>{previewLiq.totalSesiones}</b> sesiones atendidas de <b>{previewLiq.pacientes}</b> paciente(s) ×
                      ${(previewLiq.os.arancelSesion || 0).toLocaleString('es-AR')} = <b>${previewLiq.monto.toLocaleString('es-AR')}</b>
                    </span>
                  ) : (
                    <span>No hay turnos marcados como "Atendido" de pacientes de {previewLiq.os.sigla || previewLiq.os.nombre} en {mesALabel(mes)}. Marcá los turnos en la Agenda para que se sumen.</span>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Observaciones / N° de Planilla</label>
                <textarea
                  rows={2}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: Presentación ante el Colegio de Psicólogos de Corrientes..."
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                >
                  Generar y Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ARANCELES POR OBRA SOCIAL */}
      {isArancelesOpen && (
        <div className="modal-backdrop">
          <div className="card max-w-lg w-full p-5 sm:p-6 shadow-[var(--shadow-hover)] space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-semibold font-display text-slate-900 dark:text-white">Aranceles por obra social</h3>
              <button onClick={() => setIsArancelesOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={17} />
              </button>
            </div>
            <form onSubmit={handleGuardarAranceles} className="space-y-2 text-xs">
              <div className="grid grid-cols-[1fr_96px_96px] gap-2 font-semibold text-slate-500 text-[11px]">
                <span>Obra social</span><span>Arancel ($)</span><span>Coseguro ($)</span>
              </div>
              {arancelesDraft.map((os, i) => (
                <div key={os.id} className="grid grid-cols-[1fr_96px_96px] gap-2 items-center">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate" title={os.nombre}>{os.nombre}</span>
                  {['arancelSesion', 'coseguroRecomendado'].map(campo => (
                    <input
                      key={campo}
                      type="number"
                      min="0"
                      step="100"
                      value={os[campo] ?? 0}
                      onChange={(e) => {
                        const next = [...arancelesDraft];
                        next[i] = { ...next[i], [campo]: Math.max(0, Number(e.target.value) || 0) };
                        setArancelesDraft(next);
                      }}
                      className="input-field text-xs font-mono text-right"
                    />
                  ))}
                </div>
              ))}
              <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setIsArancelesOpen(false)} className="btn btn-secondary text-xs">Cancelar</button>
                <button type="submit" className="btn btn-primary text-xs">Guardar aranceles</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
