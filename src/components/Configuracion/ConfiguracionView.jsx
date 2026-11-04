import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  Building2, 
  MessageSquare, 
  Database, 
  Save, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  Upload,
  Sparkles,
  Zap,
  Gift,
  Key,
  Check,
  Lock,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Activity,
  FileText,
  Cookie,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { exportFullBackup, resetToDemoData } from '../../services/storage';
import { ProBadge } from '../Common/ProBadge';
import { PLANS, PLAN_LIMITS, activatePromoCode, switchPlanDirectly } from '../../services/subscription';
import { validarCuit } from '../../services/arcaService';
import {
  probarConexionArca,
  getArcaCredenciales,
  saveArcaCredenciales,
  borrarArcaCredenciales,
} from '../../services/arcaClient';

const leerArchivoTexto = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ''));
  r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  r.readAsText(file);
});
import { isConsultorioLocked, lockConsultorio, setConsultorioPin } from '../../services/securityService';
import { useToast } from '../Common/Toast';

export const ConfiguracionView = ({
  config,
  sedes,
  obrasSociales,
  subscription = { plan: PLANS.FREE },
  onSaveConfig,
  onSaveSedes,
  onOpenUpgradeModal,
  onSubscriptionUpdated,
  onOpenLegal
}) => {
  const [formData, setFormData] = useState({ 
    puntoVenta: '0001',
    ambienteArca: 'homologacion',
    ingresosBrutos: '',
    inicioActividades: '15/03/2019',
    ...config 
  });
  const [sedesData, setSedesData] = useState([...sedes]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoMsg, setPromoMsg] = useState({ text: '', type: '' });
  const [isTestingArca, setIsTestingArca] = useState(false);
  const [arcaStatus, setArcaStatus] = useState(null);
  const [arcaCred, setArcaCred] = useState(() => getArcaCredenciales());
  const [certPendiente, setCertPendiente] = useState('');
  const [keyPendiente, setKeyPendiente] = useState('');
  const [consultorioPinInput, setConsultorioPinInput] = useState('');
  const toast = useToast();

  const isPro = subscription.plan === PLANS.PRO;

  const handleArchivoArca = async (e, tipo) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await leerArchivoTexto(file);
      if (!txt.includes('-----BEGIN')) {
        toast.showError(`El archivo ${file.name} no parece un ${tipo === 'cert' ? 'certificado' : 'archivo de clave'} en formato PEM.`);
        return;
      }
      if (tipo === 'key' && txt.includes('ENCRYPTED')) {
        toast.showError('La clave tiene contraseña. Usá la clave sin contraseña con la que generaste el pedido (.csr).');
        return;
      }
      if (tipo === 'cert') setCertPendiente(txt); else setKeyPendiente(txt);
    } catch (err) {
      toast.showError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  const handleGuardarCredenciales = () => {
    const cert = certPendiente || arcaCred?.cert;
    const key = keyPendiente || arcaCred?.key;
    if (!cert || !key) {
      toast.showError('Cargá los dos archivos: el certificado (.crt) y la clave privada (.key).');
      return;
    }
    saveArcaCredenciales({ cert, key });
    setArcaCred(getArcaCredenciales());
    setCertPendiente('');
    setKeyPendiente('');
    setArcaStatus(null);
    toast.showSuccess('Certificado guardado en este dispositivo. Ahora probá la conexión.');
  };

  const handleBorrarCredenciales = () => {
    if (!confirm('¿Borrar el certificado y la clave de ARCA de este dispositivo?')) return;
    borrarArcaCredenciales();
    setArcaCred(null);
    setArcaStatus(null);
    toast.showInfo('Certificado eliminado de este dispositivo.');
  };

  const handleTestArcaConnection = async () => {
    setIsTestingArca(true);
    setArcaStatus(null);
    try {
      const r = await probarConexionArca(formData);
      const entorno = r.ambiente === 'produccion' ? 'Producción' : 'Homologación';
      const lista = r.puntosVenta.length ? r.puntosVenta.map((p) => p.numero).join(', ') : 'ninguno';
      if (r.puntoVentaOk) {
        setArcaStatus({ ok: true, msg: `Conectado a ARCA (${entorno}). Certificado válido y punto de venta ${formData.puntoVenta} habilitado.` });
        toast.showSuccess('Conexión con ARCA verificada.');
      } else {
        setArcaStatus({
          ok: false,
          msg: `Conectado a ARCA (${entorno}) y el certificado funciona, pero el punto de venta ${formData.puntoVenta} no figura habilitado para web services. Puntos de venta encontrados: ${lista}.${r.ambiente === 'homologacion' ? ' En homologación ARCA no siempre lista puntos de venta: podés probar emitir igual.' : ''}`,
        });
      }
    } catch (err) {
      setArcaStatus({ ok: false, msg: err.message || 'No se pudo conectar con ARCA.' });
    } finally {
      setIsTestingArca(false);
    }
  };

  const handleSetLockPin = (e) => {
    e.preventDefault();
    if (!consultorioPinInput || consultorioPinInput.length < 4) {
      toast.showError('El PIN debe tener al menos 4 dígitos numéricos.');
      return;
    }
    setConsultorioPin(consultorioPinInput);
    toast.showSuccess('PIN de protección de consultorio actualizado.');
    setConsultorioPinInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveConfig(formData);
    onSaveSedes(sedesData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSedeChange = (index, field, value) => {
    const updated = [...sedesData];
    updated[index] = { ...updated[index], [field]: value };
    setSedesData(updated);
  };

  const handleAddSede = () => {
    if (!isPro && sedesData.length >= 1) {
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal('El Plan Inicial Gratuito permite 1 sede. Desbloqueá PsicoPlus PRO para gestionar consultorios ilimitados y sede virtual.');
      }
      return;
    }

    const nuevaSede = {
      id: `sede-${Date.now()}`,
      nombre: 'Nuevo Consultorio',
      direccion: 'Dirección del consultorio',
      diasAtencion: 'Lunes a Viernes',
      color: '#0d9488',
      badgeClass: 'badge-sede-centro',
      icono: 'Building2'
    };
    setSedesData([...sedesData, nuevaSede]);
  };

  const handleApplyPromo = (e) => {
    e.preventDefault();
    if (!promoInput.trim()) return;

    const res = activatePromoCode(promoInput);
    if (res.success) {
      setPromoMsg({ text: `¡Código activado con éxito! ${res.promo.descripcion}`, type: 'success' });
      toast.showSuccess(`Plan PRO Activado: ${res.promo.descripcion}`);
      if (onSubscriptionUpdated) onSubscriptionUpdated(res.subscription);
      setPromoInput('');
    } else {
      setPromoMsg({ text: res.error, type: 'error' });
    }
  };

  const handleToggleTrial = () => {
    const nextPlan = isPro ? PLANS.FREE : PLANS.PRO;
    const res = switchPlanDirectly(nextPlan);
    toast.showSuccess(`Plan cambiado a: ${nextPlan === PLANS.PRO ? 'PRO Ilimitado' : 'Gratuito'}`);
    if (onSubscriptionUpdated) onSubscriptionUpdated(res);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      
      {/* Header Configuración */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-medium text-emerald-700 dark:text-emerald-300">Preferencias del Sistema</span>
          </div>
          <h2 className="font-serif text-[2.1rem] sm:text-[2.6rem] leading-[1.04] text-slate-900 dark:text-slate-50 flex items-center gap-2.5">
            <div className="hidden" aria-hidden="true">
              <Settings size={18} />
            </div>
            <span>Configuración & Suscripción</span>
          </h2>
          <p className="text-[14px] text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
            Datos profesionales, sedes de trabajo, estado de tu plan y respaldos de seguridad.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-200 animate-fade-in">
            <CheckCircle2 size={15} />
            <span>¡Cambios guardados con éxito!</span>
          </div>
        )}
      </div>

      {/* SECCIÓN ESPECIAL: Plan & Suscripción Freemium */}
      <div className="p-6 sm:p-7 bg-emerald-900 text-white relative overflow-hidden rounded-2xl">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-5 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white font-display">Estado de tu Suscripción</h3>
                {isPro ? (
                  <ProBadge text="PRO ILIMITADO" size="sm" />
                ) : (
                  <span className="text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    PLAN INICIAL (GRATIS)
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100/75 mt-0.5">
                {isPro 
                  ? `Tenés todas las funcionalidades PRO desbloqueadas.${subscription.expiraEn ? ` Vence: ${new Date(subscription.expiraEn).toLocaleDateString('es-AR')}` : ''}`
                  : 'Estás en el plan gratuito con hasta 15 pacientes y 1 sede.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPro ? (
              <button
                type="button"
                onClick={() => onOpenUpgradeModal && onOpenUpgradeModal()}
                className="h-10 px-4 bg-[#f4f1e8] text-emerald-900 hover:bg-white font-medium text-[13px] rounded-lg transition-colors flex items-center gap-1.5 active:scale-[0.97]"
              >
                <Sparkles size={14} />
                <span>Mejorar a PRO</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleTrial}
                className="px-3.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 text-xs rounded-xl transition-all"
              >
                Cambiar a Plan Gratuito (Demo)
              </button>
            )}
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5 text-xs">
          <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10">
            <span className="text-slate-400 block text-[12px]">Pacientes:</span>
            <span className="font-semibold text-white text-sm">{isPro ? 'Ilimitados' : 'Hasta 15 pacientes'}</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10">
            <span className="text-slate-400 block text-[12px]">Sedes & Consultorios:</span>
            <span className="font-semibold text-white text-sm">{isPro ? 'Multisede Ilimitada' : '1 Sede (Física o Virtual)'}</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10">
            <span className="text-slate-400 block text-[12px]">Liquidaciones O.S.:</span>
            <span className="font-semibold text-white text-sm">{isPro ? 'Masivas por Lotes' : 'Individual'}</span>
          </div>
        </div>

        {/* Promo code redeemer */}
        <form onSubmit={handleApplyPromo} className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="relative flex-1 w-full">
            <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Ingresar código de convenio o activación"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              className="w-full h-10 pl-9 pr-3 bg-white/[0.06] border border-white/15 rounded-lg text-[13px] text-white placeholder:text-emerald-200/50 focus:outline-none focus:border-emerald-300 font-mono tracking-wider"
            />
          </div>
          <button
            type="submit"
            disabled={!promoInput.trim()}
            className="w-full sm:w-auto h-10 px-4 bg-amber-300 hover:bg-amber-200 disabled:opacity-40 text-amber-950 font-medium text-[13px] rounded-lg transition-colors"
          >
            Activar Cupón
          </button>
        </form>

        {promoMsg.text && (
          <p className={`text-xs mt-2 font-medium ${promoMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {promoMsg.type === 'success' ? '✓ ' : '⚠️ '} {promoMsg.text}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        
        {/* Sección 1: Datos Profesionales & Matrícula */}
        <div className="card p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <User size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Datos Profesionales & Facturación
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Nombre Completo y Título</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Matrícula Provincial</label>
              <input
                type="text"
                value={formData.matriculaProvincial}
                onChange={(e) => setFormData({ ...formData, matriculaProvincial: e.target.value })}
                className="input-field font-mono"
                placeholder="M.P. 1842"
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Colegio Profesional</label>
              <input
                type="text"
                value={formData.colegio}
                onChange={(e) => setFormData({ ...formData, colegio: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">CUIT / CUIL</label>
              <input
                type="text"
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                className="input-field font-mono"
              />
              {formData.cuit && !validarCuit(formData.cuit).valido && (
                <span className="text-[11px] text-rose-600 dark:text-rose-400">CUIT inválido: revisalo antes de facturar.</span>
              )}
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Condición Frente al IVA</label>
              <select
                value={formData.condicionIva}
                onChange={(e) => setFormData({ ...formData, condicionIva: e.target.value })}
                className="input-field"
              >
                <option value="Responsable Monotributo">Responsable Monotributo</option>
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Exento">Exento</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Teléfono / WhatsApp</label>
              <input
                type="text"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="input-field font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Alias Bancario</label>
              <input
                type="text"
                value={formData.aliasBancario}
                onChange={(e) => setFormData({ ...formData, aliasBancario: e.target.value })}
                className="input-field font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">CBU (22 dígitos)</label>
              <input
                type="text"
                value={formData.cbu}
                onChange={(e) => setFormData({ ...formData, cbu: e.target.value })}
                className="input-field font-mono"
              />
            </div>
          </div>
        </div>

        {/* Sección 2: Conexión Fiscal ARCA / AFIP (Factura Electrónica WSFE) */}
        <div className="card p-4 sm:p-5 space-y-3.5 border-l-4 border-l-teal-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <QrCode size={16} className="text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                Integración Fiscal ARCA (ex-AFIP) & Factura Electrónica
              </h3>
            </div>

            <button
              type="button"
              onClick={handleTestArcaConnection}
              disabled={isTestingArca}
              className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw size={13} className={isTestingArca ? 'animate-spin' : ''} />
              <span>{isTestingArca ? 'Conectando con ARCA...' : 'Probar conexión con ARCA'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            PsicoPlus pide el CAE directamente a ARCA con tu certificado digital. Por ahora emite Factura C y Recibo C (monotributistas y exentos). Guardá primero el CUIT y el punto de venta, después cargá el certificado y probá la conexión.
          </p>

          <details className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
            <summary className="font-semibold cursor-pointer">Cómo obtener tu certificado de ARCA (paso a paso)</summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Generá una clave y un pedido en tu computadora: <code className="font-mono">openssl genrsa -out psicoplus.key 2048</code> y <code className="font-mono">openssl req -new -key psicoplus.key -subj "/C=AR/O=TuNombre/CN=psicoplus/serialNumber=CUIT 20XXXXXXXXX" -out psicoplus.csr</code></li>
              <li>Para <b>pruebas</b>: en ARCA entrá al servicio "WSASS - Autogestión Certificados Homologación", pegá el .csr, descargá el certificado y autorizalo para "wsfe".</li>
              <li>Para <b>facturar en serio</b>: servicio "Administración de Certificados Digitales" con el mismo .csr; después, en "Administrador de Relaciones de Clave Fiscal", asociá el certificado al servicio "Facturación Electrónica".</li>
              <li>Creá un punto de venta tipo "Factura Electrónica - Monotributo - Web Services" en "Administración de puntos de venta y domicilios". No sirve el de "Comprobantes en línea".</li>
              <li>Cargá acá el certificado (.crt) y la clave (.key), elegí el entorno y probá la conexión.</li>
            </ol>
          </details>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Certificado ARCA (.crt / .pem)</label>
              <input type="file" accept=".crt,.pem,.cer,.txt" onChange={(e) => handleArchivoArca(e, 'cert')} className="block w-full text-xs" />
              <span className="text-[11px] text-slate-400">
                {certPendiente ? 'Certificado listo para guardar' : arcaCred?.cert ? 'Certificado cargado en este dispositivo' : 'Sin certificado'}
              </span>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Clave privada (.key)</label>
              <input type="file" accept=".key,.pem,.txt" onChange={(e) => handleArchivoArca(e, 'key')} className="block w-full text-xs" />
              <span className="text-[11px] text-slate-400">
                {keyPendiente ? 'Clave lista para guardar' : arcaCred?.key ? 'Clave cargada en este dispositivo' : 'Sin clave'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleGuardarCredenciales} disabled={!certPendiente && !keyPendiente} className="btn btn-secondary text-xs">
              Guardar certificado
            </button>
            {arcaCred?.cert && (
              <button type="button" onClick={handleBorrarCredenciales} className="text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline">
                Borrar certificado de este dispositivo
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            El certificado y la clave quedan solo en este navegador; el servidor de PsicoPlus los usa para firmar el pedido a ARCA y no los guarda. No los cargues en una computadora compartida.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Punto de Venta ARCA</label>
              <input
                type="text"
                value={formData.puntoVenta}
                onChange={(e) => setFormData({ ...formData, puntoVenta: e.target.value })}
                className="input-field font-mono text-center font-semibold"
                placeholder="0001"
                required
              />
              <span className="text-[11px] text-slate-400">Punto de venta de tipo Web Services</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Entorno de Emisión</label>
              <select
                value={formData.ambienteArca}
                onChange={(e) => setFormData({ ...formData, ambienteArca: e.target.value })}
                className="input-field text-xs font-semibold"
              >
                <option value="homologacion">Homologación (Testing / Pruebas)</option>
                <option value="produccion">Producción (ARCA Oficial)</option>
              </select>
              <span className="text-[11px] text-slate-400">Ambiente de autorización fiscal</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Ingresos Brutos</label>
              <input
                type="text"
                value={formData.ingresosBrutos}
                onChange={(e) => setFormData({ ...formData, ingresosBrutos: e.target.value })}
                className="input-field font-mono"
                placeholder="27-38452190-4 o Convenio Multilateral"
              />
              <span className="text-[11px] text-slate-400">N° de inscripción IIBB</span>
            </div>
          </div>

          {arcaStatus && (
            <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              arcaStatus.ok 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}>
              {arcaStatus.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{arcaStatus.msg}</span>
            </div>
          )}
        </div>

        {/* Sección 3: Sedes y Consultorios */}
        <div className="card p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                Sedes de Atención
              </h3>
            </div>
            
            <button
              type="button"
              onClick={handleAddSede}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>+ Agregar Sede</span>
              {!isPro && sedesData.length >= 1 && <ProBadge size="xs" text="PRO" />}
            </button>
          </div>

          <div className="space-y-3">
            {sedesData.map((sede, idx) => (
              <div key={sede.id || idx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nombre de la Sede</label>
                  <input
                    type="text"
                    value={sede.nombre}
                    onChange={(e) => handleSedeChange(idx, 'nombre', e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Dirección / Enlace</label>
                  <input
                    type="text"
                    value={sede.direccion}
                    onChange={(e) => handleSedeChange(idx, 'direccion', e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Días y Horarios</label>
                  <input
                    type="text"
                    value={sede.diasAtencion}
                    onChange={(e) => handleSedeChange(idx, 'diasAtencion', e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sección 4: Plantillas WhatsApp */}
        <div className="card p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <MessageSquare size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Plantillas de WhatsApp
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Plantilla Recordatorio de Turno
              </label>
              <textarea
                rows={2}
                value={formData.plantillaMensajeRecordatorio}
                onChange={(e) => setFormData({ ...formData, plantillaMensajeRecordatorio: e.target.value })}
                className="input-field"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Variables: <code>{'{nombre}'}</code>, <code>{'{dia}'}</code>, <code>{'{hora}'}</code>, <code>{'{sede}'}</code>.
              </p>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Plantilla Alerta Orden de Obra Social por Agotar
              </label>
              <textarea
                rows={2}
                value={formData.plantillaMensajeOrden}
                onChange={(e) => setFormData({ ...formData, plantillaMensajeOrden: e.target.value })}
                className="input-field"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Variables: <code>{'{nombre}'}</code>, <code>{'{obra_social}'}</code>, <code>{'{restantes}'}</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Sección 5: Privacidad, Seguridad Clínica & Ley 25.326 */}
        <div className="card p-4 sm:p-5 space-y-3.5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Seguridad de la Información, Privacidad & Cumplimiento Legal
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            PsicoPlus está adaptado al régimen legal de la República Argentina (Ley 25.326 de Protección de Datos Personales, Ley 26.529 de Derechos del Paciente e Historia Clínica y Código Penal Art. 156 sobre Secreto Profesional).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenLegal && onOpenLegal('terminos')}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition-all group"
            >
              <FileText size={16} className="text-emerald-600 dark:text-emerald-400 mb-1.5" />
              <div className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-emerald-400">Términos y Condiciones</div>
              <div className="text-[11px] text-slate-500">Derechos y responsabilidades</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenLegal && onOpenLegal('privacidad')}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition-all group"
            >
              <Lock size={16} className="text-emerald-600 dark:text-emerald-400 mb-1.5" />
              <div className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-emerald-400">Política de Privacidad</div>
              <div className="text-[11px] text-slate-500">Ley 25.326 y datos sensibles</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenLegal && onOpenLegal('cookies')}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition-all group"
            >
              <Cookie size={16} className="text-emerald-600 dark:text-emerald-400 mb-1.5" />
              <div className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-emerald-400">Cookies & Storage</div>
              <div className="text-[11px] text-slate-500">Gestión de preferencias</div>
            </button>

            <button
              type="button"
              onClick={() => onOpenLegal && onOpenLegal('auditoria')}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition-all group"
            >
              <Activity size={16} className="text-emerald-600 dark:text-emerald-400 mb-1.5" />
              <div className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-emerald-400">Auditoría en Vivo</div>
              <div className="text-[11px] text-slate-500">Diagnóstico de seguridad A+</div>
            </button>
          </div>
        </div>

        {/* Botón Guardar Cambios */}
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary text-xs py-2 px-5 font-semibold shadow-sm flex items-center gap-1.5">
            <Save size={14} />
            <span>Guardar Configuración</span>
          </button>
        </div>

      </form>

      {/* Sección 4: Respaldo y Base de Datos */}
      <div className="card p-4 sm:p-5 space-y-3 border-l-4 border-l-emerald-600">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
            Seguridad de Datos & Respaldos
          </h3>
        </div>

        <p className="text-xs text-slate-500">
          PsicoPlus almacena los datos de forma local y segura en el navegador. Puedes descargar copias de seguridad en formato JSON en cualquier momento o restaurar los datos iniciales de demostración.
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={exportFullBackup}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download size={13} />
            <span>Descargar Backup (JSON)</span>
          </button>

          <label className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer">
            <Upload size={13} />
            <span>Restaurar Backup (JSON)</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const parsed = JSON.parse(event.target.result);
                    if (parsed.pacientes && parsed.turnos) {
                      if (parsed.sedes) localStorage.setItem('psicoplus_sedes_v1', JSON.stringify(parsed.sedes));
                      if (parsed.obrasSociales) localStorage.setItem('psicoplus_obras_sociales_v1', JSON.stringify(parsed.obrasSociales));
                      if (parsed.pacientes) localStorage.setItem('psicoplus_pacientes_v1', JSON.stringify(parsed.pacientes));
                      if (parsed.turnos) localStorage.setItem('psicoplus_turnos_v1', JSON.stringify(parsed.turnos));
                      if (parsed.liquidaciones) localStorage.setItem('psicoplus_liquidaciones_v1', JSON.stringify(parsed.liquidaciones));
                      if (parsed.facturas) localStorage.setItem('psicoplus_facturas_v1', JSON.stringify(parsed.facturas));
                      if (parsed.config) localStorage.setItem('psicoplus_config_v1', JSON.stringify(parsed.config));
                      alert('¡Copia de seguridad restaurada con éxito! La página se recargará.');
                      window.location.reload();
                    } else {
                      alert('El archivo seleccionado no tiene el formato de respaldo válido de PsicoPlus.');
                    }
                  } catch (err) {
                    alert('Error al leer el archivo JSON: formato inválido.');
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (confirm('¿Estás segura de reiniciar los datos a la versión de demostración? Se reestablecerán pacientes y turnos iniciales.')) {
                resetToDemoData();
              }
            }}
            className="btn btn-danger text-xs flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            <span>Restaurar Datos de Demostración</span>
          </button>
        </div>
      </div>

    </div>
  );
};
