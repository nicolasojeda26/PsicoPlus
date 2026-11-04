import jsPDF from 'jspdf';
import { generarQrArcaDataUrl, codigoTipoComprobante, partesNumeroComprobante, estadoFiscalFactura, documentoReceptor } from './arcaService';

export const generateConstanciaPDF = ({ paciente, turno, config, sede }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [13, 148, 136]; // #0d9488
  const darkColor = [30, 41, 59]; // #1e293b
  const grayColor = [100, 116, 139]; // #64748b

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 25, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CONSTANCIA DE ASISTENCIA A SESIÓN PSICOLÓGICA', 105, 16, { align: 'center' });

  // Professional details
  doc.setTextColor(...darkColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(config.nombre || 'Lic. Virna Toledo', 20, 38);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text(`${config.titulo || 'Licenciada en Psicología'} | ${config.matriculaProvincial || 'M.P. 1842'}`, 20, 44);
  doc.text(`${config.colegio || 'Colegio de Psicólogos de Corrientes'} | CUIT: ${config.cuit || 'S/D'}`, 20, 49);
  doc.text(`Contacto: ${config.telefono || ''} | ${config.email || ''}`, 20, 54);

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, 58, 190, 58);

  // Body content
  doc.setTextColor(...darkColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  doc.text(`Corrientes Capital, ${fechaHoy}`, 190, 68, { align: 'right' });

  const textoCuerpo = `Por medio de la presente, la profesional que suscribe hace constar que el/la paciente ${paciente.nombreCompleto}, DNI Nº ${paciente.dni || '..........'}, asistió a sesión de atención psicológica el día ${turno?.fecha || '....................'} en el horario de ${turno?.horaInicio || '..........'} hs en ${sede?.nombre || 'el consultorio profesional'}.`;

  const splitText = doc.splitTextToSize(textoCuerpo, 170);
  doc.text(splitText, 20, 85);

  doc.text('Se extiende la presente constancia a pedido del/de la interesado/a para ser presentada ante las autoridades que correspondan.', 20, 115);

  // Signature area
  doc.setDrawColor(148, 163, 184);
  doc.line(115, 175, 185, 175);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(config.nombre || 'Lic. Virna Toledo', 150, 182, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text(config.matriculaProvincial || 'M.P. 1842', 150, 187, { align: 'center' });
  doc.text(config.colegio || 'Colegio de Psicólogos de Corrientes', 150, 192, { align: 'center' });

  // Footer note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Documento emitido digitalmente por PsicoPlus - Sistema de Gestión Clínica y Multisede', 105, 280, { align: 'center' });

  doc.save(`Constancia_${paciente.nombreCompleto.replace(/\s+/g, '_')}_${turno?.fecha || 'sesion'}.pdf`);
};

export const generatePlanillaLiquidacionPDF = ({ obraSocial, periodo, pacientes, detalle, config }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`PLANILLA DE LIQUIDACIÓN DE PRESTACIONES - ${obraSocial.nombre.toUpperCase()}`, 105, 15, { align: 'center' });

  // Details
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Profesional: ${config.nombre}`, 20, 34);
  doc.text(`Período de Facturación: ${periodo}`, 130, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Matrícula: ${config.matriculaProvincial} | CUIT: ${config.cuit}`, 20, 40);
  doc.text(`Obra Social: ${obraSocial.nombre} (${obraSocial.tipo})`, 20, 46);
  doc.text(`Arancel por sesión: $${obraSocial.arancelSesion.toLocaleString('es-AR')}`, 130, 46);

  // Table header
  let y = 58;
  doc.setFillColor(241, 245, 249);
  doc.rect(20, y - 5, 170, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PACIENTE', 23, y);
  doc.text('DNI', 65, y);
  doc.text('Nº AFILIADO / ORDEN', 95, y);
  doc.text('SESIONES', 140, y);
  doc.text('TOTAL ($)', 175, y, { align: 'right' });

  // Table rows
  y += 6;
  doc.setFont('helvetica', 'normal');
  let totalSesiones = 0;
  let totalMonto = 0;

  // Filas: el detalle guardado con la liquidación (sesiones atendidas del mes).
  // Las liquidaciones viejas, sin detalle, usan el contador manual de cada paciente.
  const filas = detalle?.length
    ? detalle.map(d => ({ nombreCompleto: d.nombre, dni: d.dni, numeroAfiliado: d.numeroAfiliado, numeroOrden: d.numeroOrden, sesiones: d.sesiones }))
    : pacientes.map(p => ({ ...p, sesiones: p.sesionesConsumidas || 0 })).filter(p => p.sesiones > 0);

  filas.forEach((p, idx) => {
    const ses = p.sesiones;
    const monto = ses * obraSocial.arancelSesion;
    totalSesiones += ses;
    totalMonto += monto;

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, y - 4, 170, 7, 'F');
    }

    doc.text(String(p.nombreCompleto || '').substring(0, 22), 23, y);
    doc.text(p.dni || '-', 65, y);
    doc.text(`${p.numeroAfiliado || '-'} (${p.numeroOrden || '-'})`.substring(0, 24), 95, y);
    doc.text(ses.toString(), 145, y);
    doc.text(`$${monto.toLocaleString('es-AR')}`, 188, y, { align: 'right' });
    y += 7;
  });

  // Table Total
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(20, y - 3, 190, y - 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL GENERAL A LIQUIDAR:', 95, y + 2);
  doc.text(`${totalSesiones}`, 145, y + 2);
  doc.text(`$${totalMonto.toLocaleString('es-AR')}`, 188, y + 2, { align: 'right' });

  // Signature
  doc.line(120, 230, 185, 230);
  doc.text('Firma y Sello Profesional', 152, 237, { align: 'center' });

  doc.save(`Liquidacion_${obraSocial.sigla}_${periodo.replace(/\s+/g, '_')}.pdf`);
};

// Factura con el mismo diseño que el comprobante que genera ARCA ("Comprobantes en línea"):
// tres copias (Original, Duplicado, Triplicado), Helvetica, bloques con borde negro.
export const generateFacturaPDF = async ({ factura = {}, config = {} }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const tipoCodigo = factura.tipoComprobanteCodigo || codigoTipoComprobante(factura.tipoComprobante);
  const letra = tipoCodigo === 6 ? 'B' : 'C';
  const titulo = tipoCodigo === 15 || tipoCodigo === 9 ? 'RECIBO' : tipoCodigo === 13 || tipoCodigo === 8 ? 'NOTA DE CRÉDITO' : 'FACTURA';
  const estadoFiscal = estadoFiscalFactura(factura);
  const cuitEmisor = String(factura.cuitEmisor || config.cuit || '').replace(/\D/g, '');
  const numeracion = partesNumeroComprobante(factura.numeroFactura, factura.puntoVenta || config.puntoVenta);
  const receptor = factura.docTipoReceptor
    ? { docTipo: Number(factura.docTipoReceptor), docNro: String(factura.pacienteDni || '').replace(/\D/g, '') }
    : documentoReceptor(factura.pacienteDni);
  const etiquetaDoc = receptor.docTipo === 80 ? 'CUIT:' : receptor.docTipo === 96 ? 'DNI:' : receptor.docTipo === 86 ? 'CUIL:' : 'Doc.:';
  const nroDoc = receptor.docTipo === 99 ? '' : receptor.docNro;

  const fecha = (iso) => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
  };
  const num = (n) => Number(n || 0).toFixed(2).replace('.', ',');
  const CONDICION_IVA_TEXTO = {
    'Responsable Inscripto': 'IVA Responsable Inscripto',
    'IVA Exento': 'IVA Sujeto Exento',
    'Monotributo': 'Responsable Monotributo',
  };
  const condIvaReceptor = CONDICION_IVA_TEXTO[factura.condicionIvaReceptor] || factura.condicionIvaReceptor || 'Consumidor Final';

  const nombreFactura = (config.nombreFactura || config.nombre || '').toUpperCase();
  const razonSocial = (config.razonSocial || config.nombre || '').toUpperCase();
  const items = factura.items?.length ? factura.items : [{ descripcion: factura.concepto || '', cantidad: 1, precioUnitario: factura.total, total: factura.total }];
  const total = Number(factura.total || 0);

  const qrDataUrl = estadoFiscal === 'sin_validez' ? null : await generarQrArcaDataUrl({
    cuitEmisor,
    puntoVenta: numeracion.puntoVenta,
    tipoComprobante: tipoCodigo,
    numeroComprobante: factura.numeroFactura,
    importe: total,
    fechaEmision: factura.fechaEmision,
    tipoDocReceptor: receptor.docTipo,
    nroDocReceptor: receptor.docNro,
    cae: factura.cae,
  });

  const X0 = 5.3;
  const X1 = 204.7;
  const W = X1 - X0;
  const negrita = (size) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(size); };
  const normal = (size) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(size); };
  const par = (label, valor, x, y, gap = 1.5, sizeL = 8, sizeV = 8) => {
    negrita(sizeL); doc.text(label, x, y);
    const w = doc.getTextWidth(label);
    normal(sizeV); doc.text(String(valor ?? ''), x + w + gap, y);
  };

  ['ORIGINAL', 'DUPLICADO', 'TRIPLICADO'].forEach((copia, idx) => {
    if (idx > 0) doc.addPage();
    doc.setDrawColor(0); doc.setTextColor(0); doc.setLineWidth(0.3);

    // Fila ORIGINAL / DUPLICADO / TRIPLICADO
    doc.rect(X0, 8, W, 9.8);
    negrita(13); doc.text(copia, 105, 14.6, { align: 'center' });

    // Encabezado
    doc.rect(X0, 17.8, W, 42.2);
    doc.setFillColor(255, 255, 255);
    doc.rect(97, 17.8, 17, 14.5, 'FD');
    negrita(26); doc.text(letra, 105.5, 27.2, { align: 'center' });
    negrita(6.5); doc.text(`COD. ${String(tipoCodigo).padStart(3, '0')}`, 105.5, 30.6, { align: 'center' });
    doc.line(105.5, 32.3, 105.5, 60);

    // Emisor (izquierda)
    negrita(10.5); doc.text(nombreFactura, 51, 27, { align: 'center' });
    par('Razón Social:', razonSocial, 7.6, 40.5, 1.5, 9, 9);
    negrita(9); doc.text('Domicilio Comercial:', 7.6, 48.3);
    const domX = 7.6 + doc.getTextWidth('Domicilio Comercial:') + 1.5;
    normal(9);
    const domLines = doc.splitTextToSize(config.domicilioComercial || '', 103 - domX);
    domLines.slice(0, 2).forEach((l, i) => doc.text(l, i === 0 ? domX : (domX + 103) / 2, 48.3 + i * 3.6, i === 0 ? {} : { align: 'center' }));
    negrita(9); doc.text('Condición frente al IVA:', 7.6, 57.2);
    doc.text(config.condicionIva || 'Responsable Monotributo', 7.6 + doc.getTextWidth('Condición frente al IVA:') + 2.5, 57.2);

    // Comprobante (derecha)
    negrita(20); doc.text(titulo, 120, 27);
    negrita(9); doc.text('Punto de Venta:', 120, 34.6);
    doc.setFontSize(10); doc.text(String(numeracion.puntoVenta).padStart(5, '0'), 146.5, 34.6);
    doc.setFontSize(9); doc.text('Comp. Nro:', 162.5, 34.6);
    doc.setFontSize(10); doc.text(String(numeracion.numero).padStart(8, '0'), 182, 34.6);
    negrita(9); doc.text('Fecha de Emisión:', 120, 40);
    doc.setFontSize(10); doc.text(fecha(factura.fechaEmision), 151, 40);
    par('CUIT:', cuitEmisor, 120, 48.3, 1.5, 9, 9);
    par('Ingresos Brutos:', String(config.ingresosBrutos || cuitEmisor).replace(/\s*\(.*\)\s*$/, ''), 120, 52.3, 1.5, 9, 9);
    negrita(9); doc.text('Fecha de Inicio de Actividades:', 120, 56.6);
    normal(9); doc.text(config.inicioActividades || '', 171.5, 56.6);

    // Período
    doc.rect(X0, 60, W, 7.4);
    negrita(9.5); doc.text('Período Facturado Desde:', 7.6, 65);
    normal(9.5); doc.text(fecha(factura.fechaServicioDesde), 56, 65);
    negrita(9.5); doc.text('Hasta:', 82, 65);
    normal(9.5); doc.text(fecha(factura.fechaServicioHasta), 93.5, 65);
    negrita(9.5); doc.text('Fecha de Vto. para el pago:', 128, 65);
    normal(9.5); doc.text(fecha(factura.fechaVencimientoPago), 174, 65);

    // Receptor
    doc.rect(X0, 68.3, W, 22.2);
    par(etiquetaDoc, nroDoc, 7.6, 72, 1.5, 9, 9);
    negrita(8); doc.text('Apellido y Nombre / Razón Social:', 124, 72, { align: 'right' });
    normal(8);
    const nomLines = doc.splitTextToSize(String(factura.pacienteNombre || '').toUpperCase(), 79);
    nomLines.slice(0, 2).forEach((l, i) => doc.text(l, i === 0 ? 124.5 : 164, 72 + i * 3, i === 0 ? {} : { align: 'center' }));
    negrita(8); doc.text('Condición frente al IVA:', 7.6, 77.8);
    normal(8); doc.text(condIvaReceptor, 46, 77.8);
    negrita(8); doc.text('Domicilio:', 124, 77.8, { align: 'right' });
    normal(8); doc.text(doc.splitTextToSize(factura.pacienteDomicilio || '', 79)[0] || '', 124.5, 77.8);
    negrita(8); doc.text('Condición de venta:', 7.6, 84.7);
    normal(8); doc.text(factura.condicionVenta || 'Contado', 40, 84.7);

    // Tabla de ítems
    const cols = [
      { t: 'Código', x0: 5.3, x1: 19 },
      { t: 'Producto / Servicio', x0: 19, x1: 69 },
      { t: 'Cantidad', x0: 69, x1: 92 },
      { t: 'U. Medida', x0: 92, x1: 106.5 },
      { t: 'Precio Unit.', x0: 106.5, x1: 135.5 },
      { t: '% Bonif', x0: 135.5, x1: 146.8 },
      { t: 'Imp. Bonif.', x0: 146.8, x1: 172 },
      { t: 'Subtotal', x0: 172, x1: 204.7 },
    ];
    doc.setFillColor(204, 204, 204);
    doc.rect(X0, 91.8, W, 6.2, 'FD');
    cols.forEach((c, i) => {
      if (i > 0) doc.line(c.x0, 91.8, c.x0, 98);
      negrita(i === 1 || i === 0 ? 8 : 7.5);
      if (i <= 1) doc.text(c.t, c.x0 + 1.6, 96); else doc.text(c.t, (c.x0 + c.x1) / 2, 96, { align: 'center' });
    });

    let y = 101.8;
    normal(8);
    items.forEach((it) => {
      const cant = Number(it.cantidad || 1);
      const precio = Number(it.precioUnitario ?? it.total ?? 0);
      const lineas = doc.splitTextToSize(String(it.descripcion || ''), 47);
      if (it.codigo) doc.text(String(it.codigo), 7.6, y);
      lineas.forEach((l, i) => doc.text(l, 20.2, y + i * 3.4));
      doc.text(num(cant), 91, y, { align: 'right' });
      normal(7); doc.text('unidades', 94.5, y); normal(8);
      doc.text(num(precio), 134.5, y, { align: 'right' });
      doc.text('0,00', 138, y);
      doc.text('0,00', 171, y, { align: 'right' });
      doc.text(num(it.total ?? cant * precio), 203.5, y, { align: 'right' });
      y += Math.max(1, lineas.length) * 3.4 + 2;
    });

    // Totales
    doc.rect(X0, 182.3, W, 33);
    negrita(9.5);
    doc.text('Subtotal: $', 173, 197, { align: 'right' });
    doc.text(num(total), 202, 197, { align: 'right' });
    doc.text('Importe Otros Tributos: $', 173, 203.3, { align: 'right' });
    doc.text('0,00', 202, 203.3, { align: 'right' });
    negrita(10.5);
    doc.text('Importe Total: $', 173, 209.8, { align: 'right' });
    doc.text(num(total), 202, 209.8, { align: 'right' });

    if (factura.comprobanteAsociado?.numero) {
      negrita(8.5); doc.text('Comprobante asociado:', 9, 189);
      normal(8.5); doc.text(`${factura.comprobanteAsociado.tipo || 'Factura C'} ${factura.comprobanteAsociado.numero}`, 9 + doc.getTextWidth('Comprobante asociado:') + 2, 189);
    }

    if (estadoFiscal !== 'valida') {
      doc.setTextColor(200, 0, 0);
      negrita(9);
      doc.text(
        estadoFiscal === 'prueba' ? ['COMPROBANTE DE PRUEBA (HOMOLOGACIÓN)', 'SIN VALIDEZ FISCAL'] : ['DOCUMENTO NO VÁLIDO COMO FACTURA', 'SIN CAE DE ARCA'],
        9, 192,
      );
      doc.setTextColor(0);
    }

    // Pie: QR, leyendas, página y CAE
    if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', 8.8, 231.5, 25, 25);
    negrita(17); doc.text('ARCA', 39.7, 236.6);
    normal(3.6); doc.text(['AGENCIA DE RECAUDACIÓN', 'Y CONTROL ADUANERO'], 39.7, 238.6);
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(9);
    doc.text(
      estadoFiscal === 'valida' ? 'Comprobante Autorizado' : estadoFiscal === 'prueba' ? 'Autorizado en homologación (prueba)' : 'Comprobante NO autorizado',
      39.7, 245,
    );
    doc.setFontSize(5.8);
    doc.text('Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operación', 39.7, 251);
    negrita(9); doc.text('Pág. 1/1', 97.5, 231);
    if (estadoFiscal !== 'sin_validez') {
      negrita(10); doc.text('CAE N°:', 153, 230);
      normal(10); doc.text(String(factura.cae), 168.5, 230);
      negrita(10); doc.text('Fecha de Vto. de CAE:', 129.3, 235.3);
      normal(10); doc.text(fecha(factura.vencimientoCae), 168, 235.3);
    }
  });

  const pv = String(numeracion.puntoVenta).padStart(5, '0');
  const nro = String(numeracion.numero).padStart(8, '0');
  doc.save(`${cuitEmisor || 'factura'}_${String(tipoCodigo).padStart(3, '0')}_${pv}_${nro}.pdf`);
};


