import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Download, 
  MessageCircle, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  User, 
  ShieldCheck, 
  Check, 
  X,
  QrCode,
  Building2,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { periodoLabel } from '../../lib/dates';
import { generateFacturaPDF } from '../../services/pdfGenerator';
import { generateWhatsappLink, createFacturaNotificationMessage } from '../../services/whatsapp';
import { 
  OBRAS_SOCIALES_FISCALES, 
  NOMENCLADOR_SALUD_MENTAL, 
  validarCuit, 
  codigoTipoComprobante,
  condicionIvaReceptorId,
  documentoReceptor,
  estadoFiscalFactura,
} from '../../services/arcaService';
import { autorizarComprobanteArca } from '../../services/arcaClient';

const ETIQUETA_FISCAL = {
  valida: { texto: 'Autorizada ARCA', clase: 'text-emerald-600 dark:text-emerald-400' },
  prueba: { texto: 'Prueba (homologación) · sin validez fiscal', clase: 'text-amber-600 dark:text-amber-400' },
  sin_validez: { texto: 'Sin CAE de ARCA · sin validez fiscal', clase: 'text-rose-600 dark:text-rose-400' },
};
import { useToast } from '../Common/Toast';

export const FacturasView = ({
  facturas = [],
  pacientes = [],
  config = {},
  onSaveFactura,
  onDeleteFactura,
  onUpdateFacturaEstado,
  preselectedPaciente = null,
  onClearPreselectedPaciente
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterObraSocial, setFilterObraSocial] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFactura, setEditingFactura] = useState(null);
  const [isAuthorizingArca, setIsAuthorizingArca] = useState(false);
  const toast = useToast();

  // Form State
  const [modalidadEmision, setModalidadEmision] = useState('reintegro_paciente'); // 'reintegro_paciente' | 'directo_obra_social' | 'particular'
  const [formPacienteId, setFormPacienteId] = useState('');
  const [formPacienteNombre, setFormPacienteNombre] = useState('');
  const [formPacienteDni, setFormPacienteDni] = useState('');
  const [formPacienteDomicilio, setFormPacienteDomicilio] = useState('Corrientes Capital');
  const [formObraSocialId, setFormObraSocialId] = useState('osde');
  const [formNumeroAfiliado, setFormNumeroAfiliado] = useState('');
  const [formTipoComprobante, setFormTipoComprobante] = useState('Factura C');
  const [formNumeroFactura, setFormNumeroFactura] = useState('');
  const [formFechaEmision, setFormFechaEmision] = useState(() => new Date().toISOString().split('T')[0]);
  const [formPeriodo, setFormPeriodo] = useState(periodoLabel());
  const [formFechaServicioDesde, setFormFechaServicioDesde] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [formFechaServicioHasta, setFormFechaServicioHasta] = useState(() => new Date().toISOString().split('T')[0]);
  const [formFechaVencimientoPago, setFormFechaVencimientoPago] = useState(() => new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]);
  const [formCondicionVenta, setFormCondicionVenta] = useState('Transferencia Bancaria');
  const [formCondicionIvaReceptor, setFormCondicionIvaReceptor] = useState('Consumidor Final');
  const [formEstado, setFormEstado] = useState('Cobrada');
  const [formObservaciones, setFormObservaciones] = useState('');
  const [formCae, setFormCae] = useState('');
  const [formVencimientoCae, setFormVencimientoCae] = useState('');
  const [formNomencladorCodigo, setFormNomencladorCodigo] = useState('33.01.01');

  // Items table
  const [items, setItems] = useState([
    { descripcion: 'Sesión de Psicoterapia Individual (Cód. 33.01.01)', cantidad: 1, precioUnitario: 25000, total: 25000 }
  ]);

  // Totals calculations
  const totalFacturado = facturas.reduce((acc, f) => acc + (f.total || 0), 0);
  const totalCobrado = facturas.filter(f => f.estado === 'Cobrada').reduce((acc, f) => acc + (f.total || 0), 0);
  const totalPendiente = facturas.filter(f => f.estado === 'Pendiente').reduce((acc, f) => acc + (f.total || 0), 0);
  const totalConCae = facturas.filter(f => estadoFiscalFactura(f) === 'valida').length;
  const [arcaAutorizacion, setArcaAutorizacion] = useState(null);
  const [facturaAutorizada, setFacturaAutorizada] = useState(null);
  const [formId, setFormId] = useState('');

  // Filtrado de lista
  const facturasFiltradas = facturas.filter(f => {
    const matchSearch = 
      (f.pacienteNombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.pacienteDni || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.numeroFactura || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.concepto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.obraSocialNombre || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchTipo = filterTipo === 'all' || f.tipoComprobante === filterTipo;
    const matchEstado = filterEstado === 'all' || f.estado === filterEstado;
    const matchOs = filterObraSocial === 'all' || f.obraSocialId === filterObraSocial || (f.obraSocialNombre && f.obraSocialNombre.toLowerCase().includes(filterObraSocial.toLowerCase()));

    return matchSearch && matchTipo && matchEstado && matchOs;
  });

  // Próximo número de factura
  const getNextFacturaNumber = () => {
    if (!facturas.length) return '0001-00000146';
    const lastNum = facturas.reduce((max, f) => {
      const match = (f.numeroFactura || '').match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        return num > max ? num : max;
      }
      return max;
    }, 145);
    return `0001-${String(lastNum + 1).padStart(8, '0')}`;
  };

  const handleOpenNuevo = (preselected = null) => {
    setEditingFactura(null);
    const nextNum = getNextFacturaNumber();
    setFormNumeroFactura(nextNum);
    setFormFechaEmision(new Date().toISOString().split('T')[0]);
    setFormPeriodo(periodoLabel());
    setFormTipoComprobante('Factura C');
    setFormCondicionVenta('Transferencia Bancaria');
    setFormCondicionIvaReceptor('Consumidor Final');
    setFormEstado('Cobrada');
    setFormNomencladorCodigo('33.01.01');
    setFormObservaciones('Prestaciones de salud mental. Comprobante para reintegro ante obra social / prepaga.');
    
    // El CAE solo lo asigna ARCA al autorizar: nunca se precarga.
    setFormCae('');
    setFormVencimientoCae('');
    setArcaAutorizacion(null);
    setFacturaAutorizada(null);
    setFormId(`fac-${Date.now()}`);

    if (preselected) {
      setModalidadEmision(preselected.obraSocialId && preselected.obraSocialId !== 'particular' ? 'reintegro_paciente' : 'particular');
      setFormPacienteId(preselected.id);
      setFormPacienteNombre(preselected.nombreCompleto);
      setFormPacienteDni(preselected.dni || '');
      setFormNumeroAfiliado(preselected.numeroAfiliado || '');
      setFormObraSocialId(preselected.obraSocialId || 'particular');

      const precio = preselected.coseguroPactado !== undefined && preselected.coseguroPactado > 0 
        ? preselected.coseguroPactado 
        : 25000;

      const descItem = preselected.obraSocialId !== 'particular' 
        ? `Coseguro por Atención Psicológica (${preselected.obraSocialId.toUpperCase()}) - Cód. 33.01.01` 
        : 'Sesión de Psicoterapia Individual (Cód. 33.01.01)';

      setItems([{
        descripcion: descItem,
        cantidad: 1,
        precioUnitario: precio,
        total: precio
      }]);
    } else if (pacientes.length > 0) {
      const p = pacientes[0];
      setFormPacienteId(p.id);
      setFormPacienteNombre(p.nombreCompleto);
      setFormPacienteDni(p.dni || '');
      setFormNumeroAfiliado(p.numeroAfiliado || '');
      setFormObraSocialId(p.obraSocialId || 'osde');
      setItems([{ descripcion: 'Sesión de Psicoterapia Individual (Cód. 33.01.01)', cantidad: 1, precioUnitario: 25000, total: 25000 }]);
    }

    setIsModalOpen(true);
  };

  useEffect(() => {
    if (preselectedPaciente) {
      handleOpenNuevo(preselectedPaciente);
      if (onClearPreselectedPaciente) onClearPreselectedPaciente();
    }
  }, [preselectedPaciente]);

  const handleSelectPaciente = (pacId) => {
    setFormPacienteId(pacId);
    const p = pacientes.find(item => item.id === pacId);
    if (p) {
      setFormPacienteNombre(p.nombreCompleto);
      setFormPacienteDni(p.dni || '');
      setFormNumeroAfiliado(p.numeroAfiliado || '');
      setFormObraSocialId(p.obraSocialId || 'osde');
      const precio = p.coseguroPactado !== undefined && p.coseguroPactado > 0 ? p.coseguroPactado : 25000;
      
      const descItem = p.obraSocialId !== 'particular' 
        ? `Coseguro por Atención Psicológica (${p.obraSocialId.toUpperCase()}) - Cód. 33.01.01` 
        : 'Sesión de Psicoterapia Individual (Cód. 33.01.01)';

      setItems([{
        descripcion: descItem,
        cantidad: 1,
        precioUnitario: precio,
        total: precio
      }]);
    }
  };

  const handleSelectModalidad = (mod) => {
    setModalidadEmision(mod);
    if (mod === 'directo_obra_social') {
      const os = OBRAS_SOCIALES_FISCALES.find(o => o.id === formObraSocialId) || OBRAS_SOCIALES_FISCALES[0];
      setFormPacienteNombre(os.nombre);
      setFormPacienteDni(os.cuit);
      setFormPacienteDomicilio(os.domicilioFiscal);
      setFormCondicionIvaReceptor(os.condicionIva);
      setItems([{
        descripcion: `Liquidación de Prestaciones Psicológicas Ambulatorias (${os.sigla}) - Cód. 33.01.01`,
        cantidad: 4,
        precioUnitario: 22000,
        total: 88000
      }]);
      setFormObservaciones(`Facturación directa a ${os.sigla} por prestaciones brindadas durante el período.`);
    } else if (mod === 'reintegro_paciente') {
      if (pacientes.length > 0) {
        handleSelectPaciente(formPacienteId || pacientes[0].id);
      }
      setFormCondicionIvaReceptor('Consumidor Final');
      setFormObservaciones('Comprobante emitido según normas de ARCA y Ley 23.660 / 23.661 para gestión de reintegro de prestaciones de salud mental.');
    }
  };

  const handleSelectObraSocialFiscal = (osId) => {
    setFormObraSocialId(osId);
    const os = OBRAS_SOCIALES_FISCALES.find(o => o.id === osId);
    if (os && modalidadEmision === 'directo_obra_social') {
      setFormPacienteNombre(os.nombre);
      setFormPacienteDni(os.cuit);
      setFormPacienteDomicilio(os.domicilioFiscal);
      setFormCondicionIvaReceptor(os.condicionIva);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === 'cantidad') {
      item.cantidad = Math.max(1, parseInt(value, 10) || 1);
      item.total = item.cantidad * item.precioUnitario;
    } else if (field === 'precioUnitario') {
      item.precioUnitario = Math.max(0, parseFloat(value) || 0);
      item.total = item.cantidad * item.precioUnitario;
    } else {
      item[field] = value;
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const handleAddItem = () => {
    const nom = NOMENCLADOR_SALUD_MENTAL.find(n => n.codigo === formNomencladorCodigo) || NOMENCLADOR_SALUD_MENTAL[0];
    setItems([
      ...items, 
      { descripcion: `${nom.descripcion} (Cód. ${nom.codigo})`, cantidad: 1, precioUnitario: 25000, total: 25000 }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, idx) => idx !== index));
    }
  };

  const calculateSubtotal = () => items.reduce((acc, item) => acc + (item.total || 0), 0);

  // Arma el comprobante tal como se guarda en la app.
  const buildFacturaData = (extra = {}) => {
    const subtotal = calculateSubtotal();
    const selectedOs = OBRAS_SOCIALES_FISCALES.find(o => o.id === formObraSocialId);
    return {
      id: editingFactura ? editingFactura.id : (formId || `fac-${Date.now()}`),
      numeroFactura: formNumeroFactura || getNextFacturaNumber(),
      tipoComprobante: formTipoComprobante,
      fechaEmision: formFechaEmision,
      modalidadEmision: modalidadEmision,
      pacienteId: formPacienteId,
      pacienteNombre: formPacienteNombre || 'Consumidor Final',
      pacienteDni: formPacienteDni,
      pacienteDomicilio: formPacienteDomicilio,
      condicionIvaReceptor: formCondicionIvaReceptor,
      condicionVenta: formCondicionVenta,
      periodoFacturado: formPeriodo,
      fechaServicioDesde: formFechaServicioDesde,
      fechaServicioHasta: formFechaServicioHasta,
      fechaVencimientoPago: formFechaVencimientoPago,
      obraSocialId: formObraSocialId,
      obraSocialNombre: selectedOs ? selectedOs.sigla : formObraSocialId.toUpperCase(),
      numeroAfiliado: formNumeroAfiliado,
      nomencladorCodigo: formNomencladorCodigo,
      concepto: items.map(i => i.descripcion).join(', '),
      items: items,
      subtotal: subtotal,
      descuento: 0,
      total: subtotal,
      estado: formEstado,
      cae: formCae,
      vencimientoCae: formVencimientoCae,
      observaciones: formObservaciones,
      ...(arcaAutorizacion || {}),
      ...extra,
    };
  };

  // Autorización real en ARCA (WSAA + WSFEv1). Si ARCA aprueba, la factura se guarda en el acto:
  // el comprobante ya existe en ARCA y no puede perderse aunque se cierre el formulario.
  const handleAuthorizeArca = async () => {
    if (arcaAutorizacion) return;
    const tipoCodigo = codigoTipoComprobante(formTipoComprobante);
    if (tipoCodigo === 6) {
      toast.showError('Por ahora ARCA se conecta para Factura C y Recibo C (monotributistas y exentos). La Factura B todavía no está soportada.');
      return;
    }
    const condId = condicionIvaReceptorId(formCondicionIvaReceptor);
    if (!condId) {
      toast.showError('Elegí la condición frente al IVA del receptor.');
      return;
    }
    const receptor = documentoReceptor(formPacienteDni);
    if (modalidadEmision === 'directo_obra_social' && receptor.docTipo !== 80) {
      toast.showError('Para facturar a una obra social hace falta su CUIT (11 dígitos).');
      return;
    }
    if (receptor.docTipo === 80 && !validarCuit(formPacienteDni).valido) {
      toast.showError('El CUIT del receptor no es válido.');
      return;
    }

    setIsAuthorizingArca(true);
    try {
      const res = await autorizarComprobanteArca({
        config,
        comprobante: {
          tipoComprobante: tipoCodigo,
          docTipo: receptor.docTipo,
          docNro: receptor.docNro,
          condicionIvaReceptorId: condId,
          total: calculateSubtotal(),
          fechaEmision: formFechaEmision,
          fechaServicioDesde: formFechaServicioDesde,
          fechaServicioHasta: formFechaServicioHasta,
          fechaVencimientoPago: formFechaVencimientoPago,
        },
      });

      const datosArca = {
        numeroFactura: res.numeroFactura,
        cae: res.cae,
        vencimientoCae: res.vencimientoCae,
        arcaAutorizado: true,
        arcaAmbiente: res.ambiente,
        tipoComprobanteCodigo: res.tipoComprobanteCodigo,
        puntoVenta: res.puntoVenta,
        docTipoReceptor: receptor.docTipo,
        cuitEmisor: String(config.cuit || '').replace(/\D/g, ''),
        fechaAutorizacionArca: new Date().toISOString(),
      };
      setArcaAutorizacion(datosArca);
      setFormNumeroFactura(res.numeroFactura);
      setFormCae(res.cae);
      setFormVencimientoCae(res.vencimientoCae);
      const guardada = buildFacturaData(datosArca);
      setFacturaAutorizada(guardada);
      onSaveFactura(guardada);

      const obs = res.observaciones?.length ? ` Observaciones de ARCA: ${res.observaciones.map(o => o.mensaje).join(' · ')}` : '';
      if (res.ambiente === 'produccion') {
        toast.showSuccess(`Autorizada por ARCA. Comprobante ${res.numeroFactura}, CAE ${res.cae}. Ya quedó guardada.${obs}`);
      } else {
        toast.showInfo(`Autorizada en HOMOLOGACIÓN (prueba, sin validez fiscal). Comprobante ${res.numeroFactura}, CAE ${res.cae}.${obs}`);
      }
    } catch (err) {
      console.error('Error autorizando comprobante ARCA:', err);
      toast.showError(err.message || 'No se pudo obtener la autorización de ARCA.');
    } finally {
      setIsAuthorizingArca(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Una factura ya autorizada no cambia sus datos fiscales: solo estado de cobro y observaciones.
    const facturaData = facturaAutorizada
      ? { ...facturaAutorizada, estado: formEstado, observaciones: formObservaciones }
      : buildFacturaData();

    onSaveFactura(facturaData);
    if (estadoFiscalFactura(facturaData) === 'sin_validez') {
      toast.showInfo(`Comprobante ${facturaData.numeroFactura} guardado como borrador interno (sin CAE de ARCA, no tiene validez fiscal).`);
    } else {
      toast.showSuccess(`Comprobante ${facturaData.numeroFactura} guardado.`);
    }
    setIsModalOpen(false);
  };

  const handleDownloadPDF = async (factura) => {
    try {
      const paciente = pacientes.find(p => p.id === factura.pacienteId) || {
        nombreCompleto: factura.pacienteNombre,
        dni: factura.pacienteDni,
        direccion: factura.pacienteDomicilio
      };
      const obraSocial = OBRAS_SOCIALES_FISCALES.find(os => os.id === factura.obraSocialId || os.sigla === factura.obraSocialNombre);
      toast.showInfo('Generando PDF oficial con Código QR fiscal de ARCA...');
      await generateFacturaPDF({ factura, config, paciente, obraSocial });
      toast.showSuccess('Factura PDF descargada con QR y CAE oficial.');
    } catch (err) {
      console.error('Error al generar PDF de la factura:', err);
      toast.showError('No se pudo generar la factura: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleSendWhatsapp = (factura) => {
    const paciente = pacientes.find(p => p.id === factura.pacienteId);
    const telefono = paciente?.telefono || '';
    if (!telefono) {
      alert('El paciente no tiene un número de teléfono cargado.');
      return;
    }
    const message = createFacturaNotificationMessage({
      config,
      factura,
      pacienteNombre: factura.pacienteNombre
    });
    const url = generateWhatsappLink(telefono, message);
    window.open(url, '_blank');
  };

  // Validación rápida de CUIT del receptor si aplica
  const cuitVal = String(formPacienteDni || '').replace(/\D/g, '').length === 11 ? validarCuit(formPacienteDni) : null;

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-emerald-900 text-white p-6 sm:p-7 rounded-3xl shadow-[var(--shadow-hover)] border border-emerald-500/30 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5 shadow-xs">
              <ShieldCheck size={12} className="text-emerald-400" /> Facturación Oficial ARCA & O.S.
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center gap-1.5 shadow-xs">
              <QrCode size={11} className="text-teal-300" /> RG 4291 con QR
            </span>
          </div>
          <h2 className="font-serif text-[2.1rem] sm:text-[2.6rem] leading-[1.04] text-white">Facturación fiscal electrónica</h2>
          <p className="text-emerald-100/75 text-xs mt-1 max-w-2xl leading-relaxed">
            Generá Facturas C, B y Recibos con Código QR oficial de ARCA para reintegros de OSDE, Swiss Medical, IOSCOR, Medifé y más.
          </p>
        </div>

        <button
          onClick={() => handleOpenNuevo()}
          className="btn btn-primary text-xs py-2.5 px-5 shadow-sm self-start md:self-auto font-semibold flex items-center gap-2 relative z-10 active:scale-95"
        >
          <Plus size={16} />
          <span>Emitir Factura / Recibo</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate-500 dark:text-emerald-300/70 uppercase tracking-wider">Total Facturado</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <DollarSign size={18} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold font-display text-slate-900 dark:text-white mt-2 tabular-nums tracking-tight">
            ${totalFacturado.toLocaleString('es-AR')}
          </h3>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-1">
            {facturas.length} comprobantes emitidos
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Cobrado</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold font-display text-emerald-700 dark:text-emerald-400 mt-2 tabular-nums tracking-tight">
            ${totalCobrado.toLocaleString('es-AR')}
          </h3>
          <p className="text-[12px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-1">
            Acreditado o recibido
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Pendiente</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
              <Clock size={18} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold font-display text-amber-700 dark:text-amber-400 mt-2 tabular-nums tracking-tight">
            ${totalPendiente.toLocaleString('es-AR')}
          </h3>
          <p className="text-[12px] text-amber-600/80 dark:text-amber-400/80 font-medium mt-1">
            Por liquidar / cobrar
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">ARCA Oficial</span>
            <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20 group-hover:scale-105 transition-transform">
              <FileCheck size={18} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold font-display text-teal-700 dark:text-teal-400 mt-2 tabular-nums tracking-tight">
            {totalConCae} con CAE
          </h3>
          <p className="text-[12px] text-teal-600/80 dark:text-teal-400/80 font-medium mt-1">
            Comprobantes con QR válido
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por paciente, DNI, Obra Social o Nro Factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterObraSocial}
            onChange={(e) => setFilterObraSocial(e.target.value)}
            className="input-field py-1.5 px-2.5 text-xs w-auto font-medium"
          >
            <option value="all">Todas las Coberturas</option>
            {OBRAS_SOCIALES_FISCALES.map(os => (
              <option key={os.id} value={os.id}>{os.sigla}</option>
            ))}
            <option value="particular">Particular</option>
          </select>

          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="input-field py-1.5 px-2.5 text-xs w-auto"
          >
            <option value="all">Todos los Tipos</option>
            <option value="Factura C">Factura C</option>
            <option value="Factura B">Factura B</option>
            <option value="Recibo de Honorarios">Recibo de Honorarios</option>
          </select>

          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="input-field py-1.5 px-2.5 text-xs w-auto"
          >
            <option value="all">Todos los Estados</option>
            <option value="Cobrada">Cobradas</option>
            <option value="Pendiente">Pendientes</option>
          </select>
        </div>
      </div>

      {/* Facturas Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Comprobante Fiscal</th>
                <th className="px-4 py-3">Fecha & Período</th>
                <th className="px-4 py-3">Receptor / Cobertura</th>
                <th className="px-4 py-3">Concepto & CAE</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {facturasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-slate-400">
                    <Receipt size={28} className="mx-auto text-slate-300 mb-1.5 opacity-50" />
                    <p className="font-medium text-xs">No se encontraron comprobantes con los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                facturasFiltradas.map((factura) => {
                  const isCobrada = factura.estado === 'Cobrada';
                  const isFacturaC = factura.tipoComprobante?.includes('Factura C');

                  return (
                    <tr key={factura.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Comprobante */}
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            isFacturaC 
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                              : 'bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                          }`}>
                            {factura.tipoComprobante}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{factura.numeroFactura}</span>
                        </div>
                        {(() => {
                          const ef = ETIQUETA_FISCAL[estadoFiscalFactura(factura)];
                          return (
                            <div className={`text-[11px] mt-0.5 font-sans flex items-center gap-1 ${ef.clase}`}>
                              {estadoFiscalFactura(factura) === 'valida' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                              <span>{factura.cae && factura.arcaAutorizado ? `CAE ${factura.cae} · ` : ''}{ef.texto}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{factura.fechaEmision}</div>
                        <div className="text-[11px] text-slate-400">{factura.periodoFacturado || 'Mes en curso'}</div>
                      </td>

                      {/* Paciente y Obra Social */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          {factura.pacienteNombre}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>DNI: {factura.pacienteDni || 'S/D'}</span>
                          {factura.obraSocialNombre && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold text-[10.5px]">
                              {factura.obraSocialNombre}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Concepto */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-slate-700 dark:text-slate-300 font-medium" title={factura.concepto}>
                          {factura.concepto || 'Servicios Profesionales de Psicología'}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>Pago: {factura.condicionVenta}</span>
                          {factura.numeroAfiliado && <span>• Afil: {factura.numeroAfiliado}</span>}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white font-mono">
                          ${Number(factura.total).toLocaleString('es-AR')}
                        </div>
                      </td>

                      {/* Estado Toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onUpdateFacturaEstado(factura.id, isCobrada ? 'Pendiente' : 'Cobrada')}
                          title="Click para cambiar estado"
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                            isCobrada
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {isCobrada ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          <span>{factura.estado}</span>
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleDownloadPDF(factura)}
                            title="Descargar PDF Oficial con QR de ARCA"
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-900"
                          >
                            <Download size={13} />
                          </button>

                          <button
                            onClick={() => handleSendWhatsapp(factura)}
                            title="Enviar aviso por WhatsApp"
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-900"
                          >
                            <MessageCircle size={13} />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar la factura ${factura.numeroFactura}?`)) {
                                onDeleteFactura(factura.id);
                              }
                            }}
                            title="Eliminar Factura"
                            className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors border border-rose-200 dark:border-rose-900"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Emisión Factura / Recibo con ARCA */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="card max-w-2xl w-full p-5 sm:p-6 shadow-[var(--shadow-pop)] space-y-4 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold font-display text-slate-900 dark:text-white flex items-center gap-1.5">
                    {editingFactura ? 'Editar Comprobante' : 'Emisión de Factura Fiscal Oficial'}
                    <span className="text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold rounded border border-emerald-500/20">
                      ARCA WSFE
                    </span>
                  </h3>
                  <p className="text-[12px] text-slate-400">Comprobante electrónico válido para reintegros y obras sociales</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de Modalidad */}
            <div className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleSelectModalidad('reintegro_paciente')}
                className={`flex-1 py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
                  modalidadEmision === 'reintegro_paciente'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <User size={13} />
                <span>Reintegro Paciente (O.S.)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectModalidad('directo_obra_social')}
                className={`flex-1 py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
                  modalidadEmision === 'directo_obra_social'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Building2 size={13} />
                <span>Directa a Obra Social</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectModalidad('particular')}
                className={`flex-1 py-1.5 px-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
                  modalidadEmision === 'particular'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>Particular</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Comprobante
                  </label>
                  <select
                    value={formTipoComprobante}
                    onChange={(e) => setFormTipoComprobante(e.target.value)}
                    className="input-field text-xs"
                  >
                    <option value="Factura C">Factura C (Monotributo - Cód 011)</option>
                    <option value="Recibo de Honorarios">Recibo C (Honorarios - Cód 015)</option>
                    <option value="Factura B">Factura B (Resp. Inscripto - Cód 006 · sin conexión ARCA todavía)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Número de Comprobante
                  </label>
                  <input
                    type="text"
                    value={formNumeroFactura}
                    onChange={(e) => setFormNumeroFactura(e.target.value)}
                    placeholder="0001-00000146"
                    className="input-field text-xs font-mono font-semibold"
                    readOnly={Boolean(arcaAutorizacion)}
                    required
                  />
                  <span className="text-[11px] text-slate-400">
                    {arcaAutorizacion ? 'Número asignado por ARCA' : 'ARCA asigna el número definitivo al autorizar'}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha de Emisión
                  </label>
                  <input
                    type="date"
                    value={formFechaEmision}
                    onChange={(e) => setFormFechaEmision(e.target.value)}
                    className="input-field text-xs"
                    required
                  />
                </div>
              </div>

              {/* Cobertura de Obra Social y Nomenclador */}
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 space-y-2.5">
                <span className="text-[12px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} /> Cobertura Médica & Código Nomenclador de Salud Mental
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[12px] text-slate-600 dark:text-slate-400 mb-1">
                      Obra Social / Prepaga
                    </label>
                    <select
                      value={formObraSocialId}
                      onChange={(e) => handleSelectObraSocialFiscal(e.target.value)}
                      className="input-field text-xs font-semibold"
                    >
                      {OBRAS_SOCIALES_FISCALES.map(os => (
                        <option key={os.id} value={os.id}>{os.sigla} ({os.tipo})</option>
                      ))}
                      <option value="particular">Particular (Sin obra social)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-600 dark:text-slate-400 mb-1">
                      N° Afiliado / Credencial
                    </label>
                    <input
                      type="text"
                      value={formNumeroAfiliado}
                      onChange={(e) => setFormNumeroAfiliado(e.target.value)}
                      placeholder="Ej: 14-89210-01"
                      className="input-field text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-600 dark:text-slate-400 mb-1">
                      Prestación Nomenclada
                    </label>
                    <select
                      value={formNomencladorCodigo}
                      onChange={(e) => setFormNomencladorCodigo(e.target.value)}
                      className="input-field text-xs"
                    >
                      {NOMENCLADOR_SALUD_MENTAL.map(nom => (
                        <option key={nom.codigo} value={nom.codigo}>
                          {nom.codigo} - {nom.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Período de servicio para ARCA */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-emerald-200/50 dark:border-emerald-900/40">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Servicio Desde (ARCA):</label>
                    <input
                      type="date"
                      value={formFechaServicioDesde}
                      onChange={(e) => setFormFechaServicioDesde(e.target.value)}
                      className="input-field text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Servicio Hasta (ARCA):</label>
                    <input
                      type="date"
                      value={formFechaServicioHasta}
                      onChange={(e) => setFormFechaServicioHasta(e.target.value)}
                      className="input-field text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Vencimiento para el Pago:</label>
                    <input
                      type="date"
                      value={formFechaVencimientoPago}
                      onChange={(e) => setFormFechaVencimientoPago(e.target.value)}
                      className="input-field text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Receptor */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} /> Datos del Receptor / Facturado a
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {modalidadEmision !== 'directo_obra_social' && (
                    <div>
                      <label className="block text-[12px] text-slate-500 mb-1">
                        Seleccionar Paciente
                      </label>
                      <select
                        value={formPacienteId}
                        onChange={(e) => handleSelectPaciente(e.target.value)}
                        className="input-field text-xs"
                      >
                        <option value="">-- Cargar manualmente --</option>
                        {pacientes.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombreCompleto} (DNI: {p.dni || 'S/D'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={modalidadEmision === 'directo_obra_social' ? 'md:col-span-2' : ''}>
                    <label className="block text-[12px] text-slate-500 mb-1">
                      {modalidadEmision === 'directo_obra_social' ? 'Razón Social de la Obra Social' : 'Nombre y Apellido'}
                    </label>
                    <input
                      type="text"
                      value={formPacienteNombre}
                      onChange={(e) => setFormPacienteNombre(e.target.value)}
                      className="input-field text-xs font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] text-slate-500">
                        {modalidadEmision === 'directo_obra_social' ? 'CUIT Entidad' : 'DNI / CUIT'}
                      </label>
                      {cuitVal && (
                        <span className={`text-[10.5px] font-semibold ${cuitVal.valido ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {cuitVal.valido ? '✓ CUIT Válido' : '⚠️ No es CUIT M11'}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formPacienteDni}
                      onChange={(e) => setFormPacienteDni(e.target.value)}
                      placeholder="38.452.190 o 30-54674125-3"
                      className="input-field text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[12px] text-slate-500 mb-1">
                      Condición IVA Receptor
                    </label>
                    <select
                      value={formCondicionIvaReceptor}
                      onChange={(e) => setFormCondicionIvaReceptor(e.target.value)}
                      className="input-field text-xs"
                    >
                      <option value="Consumidor Final">Consumidor Final</option>
                      <option value="IVA Exento">IVA Exento (Obras Sociales)</option>
                      <option value="Responsable Inscripto">Responsable Inscripto</option>
                      <option value="Monotributo">Responsable Monotributo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-500 mb-1">
                      Condición de Pago
                    </label>
                    <select
                      value={formCondicionVenta}
                      onChange={(e) => setFormCondicionVenta(e.target.value)}
                      className="input-field text-xs"
                    >
                      <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Mercado Pago">Mercado Pago / QR</option>
                      <option value="Débito">Tarjeta de Débito</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-500 mb-1">
                      Período Facturado
                    </label>
                    <input
                      type="text"
                      value={formPeriodo}
                      onChange={(e) => setFormPeriodo(e.target.value)}
                      placeholder="Septiembre 2026"
                      className="input-field text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Detalle de Prestaciones Psicológicas
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold"
                  >
                    <Plus size={13} />
                    <span>Agregar Sesión</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Descripción de la prestación"
                          value={item.descripcion}
                          onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                          className="input-field text-xs"
                          required
                        />
                      </div>
                      <div className="w-16">
                        <input
                          type="number"
                          min="1"
                          placeholder="Cant."
                          value={item.cantidad}
                          onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)}
                          className="input-field text-xs text-center font-semibold"
                          required
                        />
                      </div>
                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          placeholder="Precio Unit."
                          value={item.precioUnitario}
                          onChange={(e) => handleItemChange(idx, 'precioUnitario', e.target.value)}
                          className="input-field text-xs text-right font-semibold"
                          required
                        />
                      </div>
                      <div className="w-24 text-right font-semibold text-xs text-emerald-600 dark:text-emerald-400 pr-1">
                        ${Number(item.total).toLocaleString('es-AR')}
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Subtotal */}
                <div className="flex justify-end pt-1">
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-right min-w-[200px]">
                    <span className="text-[12px] text-slate-500">Total Comprobante:</span>
                    <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                      ${calculateSubtotal().toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fiscal CAE / ARCA */}
              <div className="p-3 bg-slate-900 rounded-2xl border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode size={13} /> Autorización Electrónica ARCA (WSFE v1)
                  </span>
                  
                  <button
                    type="button"
                    onClick={handleAuthorizeArca}
                    disabled={isAuthorizingArca || Boolean(arcaAutorizacion)}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-[#f4f1e8] font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={isAuthorizingArca ? 'animate-spin' : ''} />
                    <span>{arcaAutorizacion ? 'Autorizada' : isAuthorizingArca ? 'Autorizando en ARCA...' : 'Solicitar CAE a ARCA'}</span>
                  </button>
                </div>

                <p className={`text-[11px] ${config.ambienteArca === 'produccion' ? 'text-slate-400' : 'text-amber-300'}`}>
                  {config.ambienteArca === 'produccion'
                    ? 'Producción: el comprobante queda registrado en ARCA con validez fiscal y no se puede borrar (solo anular con nota de crédito).'
                    : 'Homologación: ARCA autoriza en su ambiente de pruebas. El CAE no tiene validez fiscal. Cambialo a Producción en Configuración cuando estés listo/a.'}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Código CAE Obtenido
                    </label>
                    <input
                      type="text"
                      value={formCae}
                      readOnly
                      placeholder="Lo asigna ARCA al autorizar"
                      className="input-field text-xs font-mono font-semibold bg-slate-950 text-emerald-400 border-emerald-900/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Vencimiento CAE
                    </label>
                    <input
                      type="date"
                      value={formVencimientoCae}
                      readOnly
                      className="input-field text-xs bg-slate-950 text-slate-200 border-emerald-900/60"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-slate-500 mb-1">
                  Observaciones / Leyenda para Auditoría de Reintegro
                </label>
                <input
                  type="text"
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Ej: Factura emitida para reintegro de OSDE / IOSCOR..."
                  className="input-field text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs py-2 px-4 font-semibold flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{arcaAutorizacion ? 'Guardar cambios' : 'Guardar como borrador (sin CAE)'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
