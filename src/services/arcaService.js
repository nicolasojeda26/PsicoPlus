// Servicio de Facturación Electrónica ARCA (Agencia de Recaudación y Control Aduanero, ex-AFIP)
// Cumplimiento estricto con RG 1415, RG 2485, RG 4291 y normativas para profesionales de la salud

import QRCode from 'qrcode';

// Catálogo de Obras Sociales y Prepagas con datos fiscales.
// CUITs verificados en noviembre 2026 contra fuentes públicas (constancias, legajos impositivos
// y sitios oficiales de cada entidad).
export const OBRAS_SOCIALES_FISCALES = [
  {
    id: 'osde',
    nombre: 'OSDE (Organización de Servicios Directos Empresarios)',
    sigla: 'OSDE',
    cuit: '30-54674125-3',
    condicionIva: 'IVA Exento',
    domicilioFiscal: 'Av. Leandro N. Alem 1067, CABA',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Prepaga'
  },
  {
    id: 'swiss-medical',
    nombre: 'Swiss Medical S.A.',
    sigla: 'SWISS MEDICAL',
    cuit: '30-65485516-8',
    condicionIva: 'Responsable Inscripto',
    domicilioFiscal: 'San Martín 323, Piso 18, CABA',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Prepaga'
  },
  {
    id: 'ioscor',
    nombre: 'IOSCOR (Instituto de Obra Social de Corrientes)',
    sigla: 'IOSCOR',
    cuit: '30-63900831-9',
    condicionIva: 'IVA Exento',
    domicilioFiscal: 'Dr. Ramón Carrillo 444, Corrientes Capital',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Obra Social Provincial'
  },
  {
    id: 'medife',
    nombre: 'Medifé Asociación Civil',
    sigla: 'MEDIFÉ',
    cuit: '30-68273765-0',
    condicionIva: 'Responsable Inscripto',
    domicilioFiscal: 'Lima 87, Piso 5, CABA',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Prepaga'
  },
  {
    id: 'sancor',
    nombre: 'Asociación Mutual SanCor',
    sigla: 'SANCOR SALUD',
    cuit: '30-59035479-8',
    condicionIva: 'IVA Exento',
    domicilioFiscal: 'Av. Arturo Illia 850, Sunchales, Santa Fe',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Prepaga'
  },
  {
    id: 'galeno',
    nombre: 'Galeno Argentina S.A.',
    sigla: 'GALENO',
    cuit: '30-52242816-3',
    condicionIva: 'Responsable Inscripto',
    domicilioFiscal: 'Av. Córdoba 1712, CABA',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Prepaga'
  },
  {
    id: 'pami',
    nombre: 'INSSJP - PAMI',
    sigla: 'PAMI',
    cuit: '30-52276392-2',
    condicionIva: 'IVA Exento',
    domicilioFiscal: 'Av. Corrientes 655, CABA',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Obra Social Nacional'
  },
  {
    id: 'ioma',
    nombre: 'IOMA (Instituto de Obra Médico Asistencial)',
    sigla: 'IOMA',
    cuit: '30-62824952-7',
    condicionIva: 'IVA Exento',
    domicilioFiscal: 'Calle 46 N° 886, La Plata, Buenos Aires',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Obra Social Provincial'
  },
  {
    id: 'osecac',
    nombre: 'OSECAC (Obra Social de Empleados de Comercio)',
    sigla: 'OSECAC',
    cuit: '30-55027355-8',
    condicionIva: 'IVA Exento',
    domicilioFiscal: 'Moreno 648, CABA',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Obra Social Sindical'
  },
  {
    id: 'union-personal',
    nombre: 'Obra Social Unión Personal de la Unión del Personal Civil de la Nación',
    sigla: 'UNION PERSONAL',
    cuit: '30-68303222-7',
    condicionIva: 'IVA Exento',
    domicilioFiscal: 'Ciudad Autónoma de Buenos Aires',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Obra Social Sindical'
  },
  {
    id: 'omint',
    nombre: 'OMINT S.A. de Servicios del Sanatorio Fleming',
    sigla: 'OMINT',
    cuit: '30-55024530-9',
    condicionIva: 'Responsable Inscripto',
    domicilioFiscal: 'Carlos Pellegrini 1363, CABA',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Prepaga'
  },
  {
    id: 'prevencion-salud',
    nombre: 'Prevención Salud S.A.',
    sigla: 'PREVENCIÓN SALUD',
    cuit: '30-71304500-0',
    condicionIva: 'Responsable Inscripto',
    domicilioFiscal: 'Ruta 34 Km 257, Sunchales, Santa Fe',
    nomencladorDefault: '33.01.01',
    exigeAfiliado: true,
    exigeFechasSesiones: true,
    tipo: 'Prepaga'
  }
];

// Nomenclador de Prestaciones de Salud Mental (Estándar FePRA / Obras Sociales)
export const NOMENCLADOR_SALUD_MENTAL = [
  { codigo: '33.01.01', descripcion: 'Psicoterapia Individual (Adultos / Adolescentes)', duracionMin: 45 },
  { codigo: '33.01.02', descripcion: 'Psicoterapia Infantil / Niños', duracionMin: 45 },
  { codigo: '33.01.03', descripcion: 'Psicoterapia Familiar o de Pareja', duracionMin: 60 },
  { codigo: '33.01.11', descripcion: 'Evaluación Psicológica / Psicodiagnóstico (Batería)', duracionMin: 60 },
  { codigo: '33.01.12', descripcion: 'Informe Psicológico Clínico / Aptitud Laboral o Educativa', duracionMin: 30 },
  { codigo: '33.01.15', descripcion: 'Orientación a Padres / Cuidadores', duracionMin: 45 },
  { codigo: '33.01.99', descripcion: 'Atención Psicológica Virtual / Telepsicología (Res. MSAL)', duracionMin: 45 },
  // Ley 24.901: Sistema de Prestaciones Básicas en Habilitación y Rehabilitación Integral a favor de las
  // Personas con Discapacidad. Nomenclador aprobado por Res. MSyAS 428/1999. Sesiones de 45 a 60 min,
  // máximo 6 horas semanales, complemento de una prestación principal.
  { codigo: 'L.24901-APOYO', descripcion: 'Prestación de Apoyo a la Discapacidad - Psicología (Ley 24.901 / Res. 428/99)', duracionMin: 60, ley: 'Ley 24.901' }
];

// Tipos de comprobantes según codificación fiscal de ARCA / AFIP
export const TIPOS_COMPROBANTE_ARCA = {
  FACTURA_C: { codigo: 11, letra: 'C', nombre: 'Factura C', receptorMonotributo: true },
  RECIBO_C: { codigo: 15, letra: 'C', nombre: 'Recibo C (Honorarios Profesionales)', receptorMonotributo: true },
  FACTURA_B: { codigo: 6, letra: 'B', nombre: 'Factura B (Resp. Inscripto)', receptorMonotributo: false },
  FACTURA_A: { codigo: 1, letra: 'A', nombre: 'Factura A (Directa a Obra Social RI)', receptorMonotributo: false },
  RECIBO_B: { codigo: 9, letra: 'B', nombre: 'Recibo B', receptorMonotributo: false }
};

// Algoritmo oficial Módulo 11 de AFIP / ARCA para validación de CUIT / CUIL
export const validarCuit = (cuitRaw) => {
  if (!cuitRaw) return { valido: false, error: 'CUIT no especificado' };
  
  const cuit = String(cuitRaw).replace(/\D/g, '');
  if (cuit.length !== 11) {
    return { valido: false, error: 'El CUIT debe contener exactamente 11 dígitos numéricos' };
  }

  const tiposValidos = ['20', '23', '24', '27', '30', '33', '34'];
  const prefijo = cuit.substring(0, 2);
  if (!tiposValidos.includes(prefijo)) {
    return { valido: false, error: `Prefijo de CUIT inválido (${prefijo}). Debe ser 20, 23, 24, 27, 30, 33 o 34.` };
  }

  const coeficientes = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += parseInt(cuit[i], 10) * coeficientes[i];
  }

  let digitoCalculado = 11 - (suma % 11);
  if (digitoCalculado === 11) digitoCalculado = 0;
  if (digitoCalculado === 10) digitoCalculado = 9;

  const digitoVerificador = parseInt(cuit[10], 10);
  const esValido = digitoCalculado === digitoVerificador;

  return {
    valido: esValido,
    error: esValido ? null : 'Dígito verificador de CUIT inválido (no supera algoritmo fiscal Módulo 11)',
    cuitFormateado: `${cuit.substring(0, 2)}-${cuit.substring(2, 10)}-${cuit.substring(10)}`
  };
};

// Formateador visual de CUIT (XX-XXXXXXXX-X)
export const formatearCuit = (val) => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`;
};

// ---------- Códigos y numeración ----------

/** Código ARCA del tipo de comprobante a partir del nombre usado en la app. */
export const codigoTipoComprobante = (tipo = '') => {
  const t = String(tipo);
  if (t.includes('Factura B')) return 6;
  if (t.includes('Recibo')) return 15;
  return 11;
};

/** Condición frente al IVA del receptor → código de ARCA (RG 5616). */
const CONDICION_IVA_IDS = {
  'responsable inscripto': 1,
  'iva responsable inscripto': 1,
  'iva exento': 4,
  'iva sujeto exento': 4,
  'exento': 4,
  'consumidor final': 5,
  'monotributo': 6,
  'responsable monotributo': 6,
  'sujeto no categorizado': 7,
  'iva no alcanzado': 15,
};
export const condicionIvaReceptorId = (texto) => CONDICION_IVA_IDS[String(texto || '').trim().toLowerCase()] ?? null;

/** Tipo y número de documento del receptor: 11 dígitos = CUIT (80), 7-8 = DNI (96), vacío = consumidor final (99). */
export const documentoReceptor = (doc) => {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) return { docTipo: 80, docNro: d };
  if (d.length >= 7 && d.length <= 8) return { docTipo: 96, docNro: d };
  return { docTipo: 99, docNro: '0' };
};

export const formatearNumeroComprobante = (puntoVenta, numero) =>
  `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;

/** "0003-00000046" → { puntoVenta: 3, numero: 46 } */
export const partesNumeroComprobante = (numeroFactura, puntoVentaDefault = 1) => {
  const m = String(numeroFactura || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (m) return { puntoVenta: parseInt(m[1], 10), numero: parseInt(m[2], 10) };
  const d = String(numeroFactura || '').replace(/\D/g, '');
  return {
    puntoVenta: parseInt(String(puntoVentaDefault).replace(/\D/g, ''), 10) || 1,
    numero: d ? parseInt(d.slice(-8), 10) : 0,
  };
};

/**
 * Estado fiscal de una factura guardada:
 * 'valida'      → autorizada por ARCA en producción.
 * 'prueba'      → autorizada en homologación (no tiene validez fiscal).
 * 'sin_validez' → nunca se autorizó en ARCA (borrador o CAE cargado a mano).
 */
export const estadoFiscalFactura = (f) => {
  if (!f?.cae || !f?.arcaAutorizado) return 'sin_validez';
  return f.arcaAmbiente === 'produccion' ? 'valida' : 'prueba';
};

// ---------- Código QR (RG 4892 / especificación ARCA v1) ----------

/** URL del QR oficial. Devuelve null si falta CUIT o CAE reales: nunca se inventan datos. */
export const generarUrlQrArca = ({
  cuitEmisor,
  puntoVenta,
  tipoComprobante = 11,
  numeroComprobante,
  importe,
  fechaEmision,
  tipoDocReceptor,
  nroDocReceptor,
  cae
}) => {
  const cuit = String(cuitEmisor || '').replace(/\D/g, '');
  const caeDig = String(cae || '').replace(/\D/g, '');
  if (cuit.length !== 11 || caeDig.length !== 14) return null;

  const { puntoVenta: pv, numero } = partesNumeroComprobante(numeroComprobante, puntoVenta);
  const receptor = tipoDocReceptor
    ? { docTipo: Number(tipoDocReceptor), docNro: String(nroDocReceptor || '').replace(/\D/g, '') || '0' }
    : documentoReceptor(nroDocReceptor);

  const payloadJson = {
    ver: 1,
    fecha: fechaEmision,
    cuit: Number(cuit),
    ptoVta: pv,
    tipoCmp: Number(tipoComprobante),
    nroCmp: numero,
    importe: Number(Number(importe || 0).toFixed(2)),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: receptor.docTipo,
    nroDocRec: Number(receptor.docNro) || 0,
    tipoCodAut: 'E',
    codAut: Number(caeDig)
  };

  const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payloadJson))));
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
};

/** Imagen DataURL del QR, o null si el comprobante no tiene CAE real. */
export const generarQrArcaDataUrl = async (params) => {
  const url = generarUrlQrArca(params);
  if (!url) return null;
  try {
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (err) {
    console.error('Error generando QR de ARCA:', err);
    return null;
  }
};
