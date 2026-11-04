import jsPDF from 'jspdf';
import { generarQrArcaDataUrl, codigoTipoComprobante, partesNumeroComprobante, estadoFiscalFactura } from './arcaService';

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

export const generateFacturaPDF = async ({ factura = {}, config = {}, paciente = {}, obraSocial = {} }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const tipoCodigo = factura.tipoComprobanteCodigo || codigoTipoComprobante(factura.tipoComprobante);
  const letra = tipoCodigo === 6 ? 'B' : 'C';
  const codigoComprobante = `COD. ${String(tipoCodigo).padStart(3, '0')}`;
  const estadoFiscal = estadoFiscalFactura(factura);
  const cuitEmisor = factura.cuitEmisor || config.cuit || '';
  const numeracion = partesNumeroComprobante(factura.numeroFactura, factura.puntoVenta || config.puntoVenta);

  // Marco exterior
  doc.setDrawColor(13, 148, 136); // Teal / Emerald
  doc.setLineWidth(0.4);
  doc.rect(14, 12, 182, 272);

  // Cuadro superior central con letra del comprobante
  doc.setFillColor(240, 253, 250);
  doc.rect(98, 12, 14, 15, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(13, 148, 136);
  doc.text(letra, 105, 22, { align: 'center' });
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(codigoComprobante, 105, 26, { align: 'center' });

  // Banner ORIGINAL
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('ORIGINAL', 105, 10, { align: 'center' });

  // Línea divisoria vertical en cabecera
  doc.setDrawColor(226, 232, 240);
  doc.line(105, 27, 105, 68);

  // Cabecera Izquierda: Datos del Profesional Emisor
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(config.nombre || 'Lic. Virna Toledo', 18, 22);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`${config.titulo || 'Licenciada en Psicología'} • ${config.matriculaProvincial || 'M.P. 1842'}`, 18, 28);
  doc.text(config.colegio || 'Colegio de Psicólogos de Corrientes', 18, 33);
  doc.text(`Domicilio Comercial: ${config.domicilioComercial || 'Pellegrini 1250, 1° Piso - Corrientes'}`, 18, 38);
  doc.text(`Condición Frente al IVA: ${config.condicionIva || 'Responsable Monotributo'}`, 18, 43);
  doc.text(`Contacto: ${config.telefono || ''} • ${config.email || ''}`, 18, 48);

  // Cabecera Derecha: Comprobante & Datos Fiscales ARCA
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(factura.tipoComprobante?.toUpperCase() || 'FACTURA C', 115, 22);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const ptoVta = String(numeracion.puntoVenta).padStart(4, '0');
  const nroComp = String(numeracion.numero).padStart(8, '0');
  doc.text(`Punto de Venta: ${ptoVta}   Comp. Nro: ${nroComp}`, 115, 28);
  doc.text(`Fecha de Emisión: ${factura.fechaEmision || new Date().toISOString().split('T')[0]}`, 115, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`CUIT Emisor: ${cuitEmisor || 'SIN CONFIGURAR'}`, 115, 40);
  doc.text(`Ingresos Brutos: ${config.ingresosBrutos || config.cuit || 'S/D'}`, 115, 45);
  doc.text(`Fecha de Inicio de Actividades: ${config.inicioActividades || '15/03/2019'}`, 115, 50);

  // Período de Prestación de Servicios (Exigido por ARCA para Servicios de Salud)
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 55, 182, 13, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('PERÍODO DE FACTURACIÓN DE SERVICIOS:', 18, 60);

  doc.setFont('helvetica', 'normal');
  const fechaDesde = factura.fechaServicioDesde || factura.fechaEmision || '2026-09-01';
  const fechaHasta = factura.fechaServicioHasta || factura.fechaEmision || '2026-09-30';
  const fechaVtoPago = factura.fechaVencimientoPago || factura.vencimientoCae || '2026-10-10';

  doc.text(`Fecha Desde: ${fechaDesde}`, 75, 60);
  doc.text(`Fecha Hasta: ${fechaHasta}`, 115, 60);
  doc.text(`Fecha Vto. para el Pago: ${fechaVtoPago}`, 150, 60);

  if (factura.periodoFacturado) {
    doc.text(`Concepto / Período: ${factura.periodoFacturado}`, 18, 65);
  }

  // Línea divisoria
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.3);
  doc.line(14, 68, 196, 68);

  // Sección Receptor / Paciente / Obra Social
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 68, 182, 30, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('DATOS DEL RECEPTOR / PACIENTE / OBRA SOCIAL', 18, 73);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Nombre / Razón Social:', 18, 79);
  doc.setFont('helvetica', 'bold');
  doc.text(factura.pacienteNombre || paciente?.nombreCompleto || 'Consumidor Final', 58, 79);

  doc.setFont('helvetica', 'normal');
  doc.text('DNI / CUIT / CUIL:', 18, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(factura.pacienteDni || paciente?.dni || 'Sin especificar', 58, 85);

  doc.setFont('helvetica', 'normal');
  doc.text('Condición Frente al IVA:', 18, 91);
  doc.text(factura.condicionIvaReceptor || 'Consumidor Final', 58, 91);

  doc.text('Domicilio:', 115, 79);
  doc.text(factura.pacienteDomicilio || paciente?.direccion || 'Corrientes Capital', 135, 79);

  doc.text('Condición de Pago:', 115, 85);
  doc.text(factura.condicionVenta || 'Transferencia Bancaria', 145, 85);

  // Si tiene datos de Obra Social o número de afiliado
  const osNombre = factura.obraSocialNombre || obraSocial?.nombre || paciente?.obraSocialId;
  const nroAfiliado = factura.numeroAfiliado || paciente?.numeroAfiliado;
  if (osNombre && osNombre !== 'particular') {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136);
    doc.text(`Cobertura: ${String(osNombre).toUpperCase()} ${nroAfiliado ? `• Afiliado/a Nº: ${nroAfiliado}` : ''}`, 115, 91);
  }

  // Divisor tabla ítems
  doc.setDrawColor(203, 213, 225);
  doc.line(14, 98, 196, 98);

  // Encabezado Tabla de Prestaciones
  doc.setFillColor(15, 23, 42);
  doc.rect(14, 100, 182, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CÓD. NOMENCLADOR / DETALLE DE LA PRESTACIÓN PSICOLÓGICA', 18, 105);
  doc.text('CANTIDAD', 125, 105, { align: 'center' });
  doc.text('PRECIO UNITARIO', 155, 105, { align: 'right' });
  doc.text('SUBTOTAL', 190, 105, { align: 'right' });

  // Filas de Ítems
  let currentY = 113;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');

  const items = (factura.items && factura.items.length > 0) 
    ? factura.items 
    : [{ descripcion: factura.concepto || 'Sesión de Psicoterapia Individual (Cód. 33.01.01)', cantidad: 1, precioUnitario: factura.total, total: factura.total }];

  items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY - 5, 182, 7, 'F');
    }

    doc.setFontSize(8);
    doc.text(item.descripcion.substring(0, 65), 18, currentY);
    doc.text(String(item.cantidad || 1), 125, currentY, { align: 'center' });
    doc.text(`$${Number(item.precioUnitario || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 155, currentY, { align: 'right' });
    doc.text(`$${Number(item.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 190, currentY, { align: 'right' });
    
    currentY += 8;
  });

  // Observaciones & Leyenda de Reintegro de Obra Social
  currentY += 3;
  doc.setDrawColor(226, 232, 240);
  doc.line(18, currentY, 192, currentY);
  currentY += 5;

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const obsTexto = factura.observaciones || 'Prestaciones de salud mental.';
  const obsSplits = doc.splitTextToSize(`Observaciones: ${obsTexto}`, 174);
  doc.text(obsSplits, 18, currentY);

  // Totales
  const totalsY = 195;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, totalsY, 196, totalsY);

  doc.setFillColor(240, 253, 250);
  doc.rect(115, totalsY + 4, 81, 24, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', 120, totalsY + 11);
  doc.text(`$${Number(factura.subtotal || factura.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 190, totalsY + 11, { align: 'right' });

  if (factura.descuento && factura.descuento > 0) {
    doc.text('Descuento:', 120, totalsY + 16);
    doc.text(`-$${Number(factura.descuento).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 190, totalsY + 16, { align: 'right' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 148, 136);
  doc.text('Importe Total:', 120, totalsY + 23);
  doc.text(`$${Number(factura.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 190, totalsY + 23, { align: 'right' });

  // Cuadro Fiscal Inferior ARCA con Código QR Oficial (RG 4291)
  const caeY = 228;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, caeY, 196, caeY);

  // Generar Código QR Oficial de ARCA
  try {
    const qrDataUrl = estadoFiscal === 'sin_validez' ? null : await generarQrArcaDataUrl({
      cuitEmisor,
      puntoVenta: numeracion.puntoVenta,
      tipoComprobante: tipoCodigo,
      numeroComprobante: factura?.numeroFactura,
      importe: factura?.total || 0,
      fechaEmision: factura?.fechaEmision,
      tipoDocReceptor: factura?.docTipoReceptor,
      nroDocReceptor: factura?.pacienteDni,
      cae: factura?.cae
    });

    if (qrDataUrl) {
      // Dibujar Código QR de ARCA (32x32 mm)
      doc.addImage(qrDataUrl, 'PNG', 18, caeY + 4, 32, 32);
    }
  } catch (qrErr) {
    console.warn('No se pudo estampar el código QR en el PDF:', qrErr);
  }

  // Texto Fiscal ARCA al lado del QR
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ARCA', 54, caeY + 9);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Agencia de Recaudación y Control Aduanero', 54, caeY + 13);
  doc.text(estadoFiscal === 'valida' ? 'Comprobante Autorizado' : estadoFiscal === 'prueba' ? 'Autorizado en homologación (prueba)' : 'Comprobante NO autorizado por ARCA', 54, caeY + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  if (estadoFiscal !== 'sin_validez') {
    doc.text(`CAE Nº: ${factura.cae}`, 54, caeY + 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Fecha de Vto. de CAE: ${factura.vencimientoCae || '-'}`, 54, caeY + 29);
  } else {
    doc.text('CAE Nº: -', 54, caeY + 24);
  }

  // Marca de agua cuando el comprobante no tiene validez fiscal
  if (estadoFiscal !== 'valida') {
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      estadoFiscal === 'prueba'
        ? 'COMPROBANTE DE PRUEBA (HOMOLOGACIÓN ARCA) · SIN VALIDEZ FISCAL'
        : 'DOCUMENTO NO VÁLIDO COMO FACTURA · SIN CAE DE ARCA',
      105, caeY - 3, { align: 'center' }
    );
    doc.setTextColor(15, 23, 42);
  }

  // Firma y Matrícula Profesional (Derecha)
  doc.setDrawColor(148, 163, 184);
  doc.line(140, caeY + 22, 188, caeY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(config?.nombre || 'Lic. Virna Toledo', 164, caeY + 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(config?.matriculaProvincial || 'M.P. 1842', 164, caeY + 30, { align: 'center' });
  doc.text(config?.colegio || 'Colegio de Psicólogos', 164, caeY + 34, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Comprobante generado con PsicoPlus', 105, 279, { align: 'center' });

  const safeNumero = String(factura?.numeroFactura || '0001').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safePaciente = String(factura?.pacienteNombre || 'Paciente').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Factura_${safeNumero}_${safePaciente}.pdf`);
};


