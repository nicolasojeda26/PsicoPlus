// Núcleo de conexión con ARCA (ex-AFIP): WSAA (autenticación) + WSFEv1 (factura electrónica).
// Se ejecuta en el servidor (función de Vercel). No guarda certificados ni claves:
// los recibe en cada pedido y los descarta al terminar.

import forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';

export const ENDPOINTS = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

const FE_NS = 'http://ar.gov.afip.dif.FEV1/';
const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });

export class ArcaError extends Error {
  constructor(message, { code, status = 400, detalles } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.detalles = detalles;
  }
}

const getEndpoints = (ambiente) => {
  const ep = ENDPOINTS[ambiente];
  if (!ep) throw new ArcaError('Ambiente inválido. Usá "homologacion" o "produccion".', { code: 'ambiente' });
  return ep;
};

const escapeXml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// Fecha ISO con offset de Argentina (UTC-3), formato aceptado por WSAA.
const isoArgentina = (date) => {
  const local = new Date(date.getTime() - 3 * 3600 * 1000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
};

const normalizarPem = (pem, tipo) => {
  const txt = String(pem || '').trim();
  if (!txt.includes('-----BEGIN')) {
    throw new ArcaError(`El ${tipo} no tiene formato PEM (debe empezar con "-----BEGIN").`, { code: 'pem' });
  }
  return txt.replace(/\r\n/g, '\n');
};

// ---------- WSAA ----------

export const crearTra = (servicio = 'wsfe', ahora = new Date()) => `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId><generationTime>${isoArgentina(new Date(ahora.getTime() - 10 * 60 * 1000))}</generationTime><expirationTime>${isoArgentina(new Date(ahora.getTime() + 10 * 60 * 1000))}</expirationTime></header><service>${servicio}</service></loginTicketRequest>`;

/** Firma el TRA en formato CMS/PKCS#7 (SignedData, con el contenido incluido) y lo devuelve en base64. */
export const firmarTra = (tra, certPem, keyPem) => {
  let cert;
  let key;
  try {
    cert = forge.pki.certificateFromPem(normalizarPem(certPem, 'certificado'));
  } catch (e) {
    if (e instanceof ArcaError) throw e;
    throw new ArcaError('No se pudo leer el certificado (.crt). Verificá que sea el que descargaste de ARCA.', { code: 'cert' });
  }
  try {
    key = forge.pki.privateKeyFromPem(normalizarPem(keyPem, 'clave privada'));
  } catch (e) {
    if (e instanceof ArcaError) throw e;
    throw new ArcaError('No se pudo leer la clave privada (.key). Tiene que ser la clave sin contraseña con la que generaste el pedido de certificado.', { code: 'key' });
  }

  const certPub = forge.pki.publicKeyToPem(cert.publicKey);
  const keyPub = forge.pki.publicKeyToPem(forge.pki.setRsaPublicKey(key.n, key.e));
  if (certPub !== keyPub) {
    throw new ArcaError('La clave privada no corresponde a este certificado.', { code: 'key_mismatch' });
  }

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
};

/** Datos útiles del certificado: CUIT y vencimiento. */
export const leerCertificado = (certPem) => {
  const cert = forge.pki.certificateFromPem(normalizarPem(certPem, 'certificado'));
  const serial = cert.subject.getField({ name: 'serialNumber' })?.value
    || cert.subject.attributes.find((a) => a.type === '2.5.4.5')?.value || '';
  const cuit = (String(serial).match(/\d{11}/) || [''])[0];
  return {
    cuit,
    titular: cert.subject.getField('CN')?.value || '',
    venceEl: cert.validity.notAfter.toISOString(),
  };
};

const postSoap = async (url, body, soapAction) => {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction },
      body,
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    throw new ArcaError('No se pudo conectar con los servidores de ARCA. Puede ser una caída temporal: probá de nuevo en unos minutos.', { code: 'red', status: 502 });
  }
  const text = await res.text();
  let parsed;
  try {
    parsed = parser.parse(text);
  } catch {
    throw new ArcaError(`ARCA respondió algo inesperado (HTTP ${res.status}).`, { code: 'respuesta', status: 502 });
  }
  const envelope = parsed?.Envelope;
  const fault = envelope?.Body?.Fault;
  if (fault) {
    return { fault: { code: String(fault.faultcode || ''), message: String(fault.faultstring || 'Error SOAP') } };
  }
  if (!envelope?.Body) {
    throw new ArcaError(`ARCA respondió algo inesperado (HTTP ${res.status}).`, { code: 'respuesta', status: 502 });
  }
  return { body: envelope.Body };
};

const MENSAJES_WSAA = {
  'coe.alreadyAuthenticated': 'ARCA ya entregó un acceso vigente para este certificado hace poco (dura hasta 12 horas). Esta app guarda ese acceso en el navegador donde se pidió: usá ese navegador o esperá a que venza.',
  'cms.cert.untrusted': 'ARCA no reconoce el certificado. Revisá que sea del ambiente correcto (homologación o producción).',
  'cms.cert.expired': 'El certificado está vencido. Generá uno nuevo en ARCA.',
  'cms.sign.invalid': 'La firma no es válida: la clave privada no corresponde al certificado.',
  'coe.notAuthorized': 'El certificado no tiene autorizado el servicio de Factura Electrónica (wsfe). Asocialo en "Administrador de Relaciones de Clave Fiscal".',
};

/** Pide un Ticket de Acceso a WSAA. Devuelve { token, sign, expiracion }. */
export const loginWsaa = async ({ ambiente, cert, key, servicio = 'wsfe' }) => {
  const { wsaa } = getEndpoints(ambiente);
  const cms = firmarTra(crearTra(servicio), cert, key);
  const soap = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
  const { fault, body } = await postSoap(wsaa, soap, '""');
  if (fault) {
    const clave = Object.keys(MENSAJES_WSAA).find((k) => fault.code.includes(k) || fault.message.includes(k));
    throw new ArcaError(clave ? MENSAJES_WSAA[clave] : `ARCA rechazó el acceso: ${fault.message}`, { code: clave || fault.code, detalles: fault.message });
  }
  const ticketXml = body?.loginCmsResponse?.loginCmsReturn;
  const ticket = parser.parse(String(ticketXml || ''))?.loginTicketResponse;
  const token = ticket?.credentials?.token;
  const sign = ticket?.credentials?.sign;
  if (!token || !sign) throw new ArcaError('ARCA no devolvió las credenciales de acceso.', { code: 'wsaa', status: 502 });
  return { token, sign, expiracion: ticket?.header?.expirationTime };
};

// ---------- WSFEv1 ----------

const authXml = ({ token, sign, cuit }) =>
  `<ar:Auth><ar:Token>${escapeXml(token)}</ar:Token><ar:Sign>${escapeXml(sign)}</ar:Sign><ar:Cuit>${String(cuit).replace(/\D/g, '')}</ar:Cuit></ar:Auth>`;

const callWsfe = async (ambiente, metodo, innerXml) => {
  const { wsfe } = getEndpoints(ambiente);
  const soap = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${FE_NS}"><soap:Body><ar:${metodo}>${innerXml}</ar:${metodo}></soap:Body></soap:Envelope>`;
  const { fault, body } = await postSoap(wsfe, soap, `"${FE_NS}${metodo}"`);
  if (fault) throw new ArcaError(`ARCA devolvió un error: ${fault.message}`, { code: 'soap_fault', status: 502 });
  const result = body?.[`${metodo}Response`]?.[`${metodo}Result`];
  if (!result) throw new ArcaError('Respuesta de ARCA sin resultado.', { code: 'respuesta', status: 502 });
  return result;
};

const erroresDe = (result) => asArray(result?.Errors?.Err).map((e) => ({ codigo: String(e.Code), mensaje: String(e.Msg) }));

const lanzarSiErrores = (result, contexto) => {
  const errores = erroresDe(result);
  if (errores.length) {
    const auth = errores.find((e) => ['600', '601', '602'].includes(e.codigo));
    throw new ArcaError(
      auth ? 'El acceso a ARCA venció o no es válido. Volvé a intentar para renovarlo.' : `${contexto}: ${errores.map((e) => `[${e.codigo}] ${e.mensaje}`).join(' · ')}`,
      { code: auth ? 'auth_expirada' : 'wsfe', detalles: errores },
    );
  }
};

export const dummy = async (ambiente) => {
  const r = await callWsfe(ambiente, 'FEDummy', '');
  return { app: r.AppServer, db: r.DbServer, auth: r.AuthServer };
};

export const puntosDeVenta = async ({ ambiente, auth }) => {
  const r = await callWsfe(ambiente, 'FEParamGetPtosVenta', authXml(auth));
  const errores = erroresDe(r);
  // 602 = "sin resultados": no es un error real, solo que no hay puntos de venta web services creados.
  if (errores.length && !errores.every((e) => e.codigo === '602')) lanzarSiErrores(r, 'No se pudieron leer los puntos de venta');
  return asArray(r?.ResultGet?.PtoVenta).map((p) => ({
    numero: Number(p.Nro),
    tipoEmision: String(p.EmisionTipo || ''),
    bloqueado: String(p.Bloqueado) === 'S',
    baja: p.FchBaja && String(p.FchBaja) !== 'NULL' ? String(p.FchBaja) : null,
  }));
};

export const ultimoAutorizado = async ({ ambiente, auth, puntoVenta, tipoComprobante }) => {
  const r = await callWsfe(ambiente, 'FECompUltimoAutorizado',
    `${authXml(auth)}<ar:PtoVta>${Number(puntoVenta)}</ar:PtoVta><ar:CbteTipo>${Number(tipoComprobante)}</ar:CbteTipo>`);
  lanzarSiErrores(r, 'No se pudo consultar el último comprobante');
  return Number(r.CbteNro || 0);
};

const TIPOS_SOPORTADOS = { 11: 'Factura C', 15: 'Recibo C' };
const DOC_TIPOS = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI', 99: 'Consumidor Final' };
const CONDICIONES_IVA_RECEPTOR = [1, 4, 5, 6, 7, 13, 15, 16];

const aYYYYMMDD = (iso, campo) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new ArcaError(`Fecha inválida en "${campo}" (se espera AAAA-MM-DD).`, { code: 'validacion' });
  return `${m[1]}${m[2]}${m[3]}`;
};

const importe = (n) => Number(Number(n || 0).toFixed(2));

/** Valida y arma el detalle del comprobante. Exportado para tests. */
export const armarDetalle = (c, numero) => {
  const tipo = Number(c.tipoComprobante);
  if (!TIPOS_SOPORTADOS[tipo]) {
    throw new ArcaError('Por ahora solo se pueden autorizar Factura C (11) y Recibo C (15), que son los de monotributistas y exentos.', { code: 'validacion' });
  }
  const docTipo = Number(c.docTipo);
  if (!DOC_TIPOS[docTipo]) throw new ArcaError('Tipo de documento del receptor inválido.', { code: 'validacion' });
  const docNro = docTipo === 99 ? 0 : Number(String(c.docNro || '').replace(/\D/g, ''));
  if (docTipo !== 99 && !docNro) throw new ArcaError('Falta el número de documento del receptor.', { code: 'validacion' });
  const condIva = Number(c.condicionIvaReceptorId);
  if (!CONDICIONES_IVA_RECEPTOR.includes(condIva)) throw new ArcaError('Falta la condición frente al IVA del receptor.', { code: 'validacion' });
  const total = importe(c.total);
  if (!(total > 0)) throw new ArcaError('El total debe ser mayor a $0.', { code: 'validacion' });

  const fecha = aYYYYMMDD(c.fechaEmision, 'fecha de emisión');
  const desde = aYYYYMMDD(c.fechaServicioDesde, 'servicio desde');
  const hasta = aYYYYMMDD(c.fechaServicioHasta, 'servicio hasta');
  const vtoPago = aYYYYMMDD(c.fechaVencimientoPago, 'vencimiento de pago');
  if (desde > hasta) throw new ArcaError('La fecha "servicio desde" no puede ser posterior a "servicio hasta".', { code: 'validacion' });
  if (vtoPago < fecha) throw new ArcaError('El vencimiento de pago no puede ser anterior a la fecha de emisión.', { code: 'validacion' });

  return `<ar:FECAEDetRequest>`
    + `<ar:Concepto>2</ar:Concepto>`
    + `<ar:DocTipo>${docTipo}</ar:DocTipo><ar:DocNro>${docNro}</ar:DocNro>`
    + `<ar:CbteDesde>${numero}</ar:CbteDesde><ar:CbteHasta>${numero}</ar:CbteHasta>`
    + `<ar:CbteFch>${fecha}</ar:CbteFch>`
    + `<ar:ImpTotal>${total}</ar:ImpTotal><ar:ImpTotConc>0</ar:ImpTotConc><ar:ImpNeto>${total}</ar:ImpNeto>`
    + `<ar:ImpOpEx>0</ar:ImpOpEx><ar:ImpTrib>0</ar:ImpTrib><ar:ImpIVA>0</ar:ImpIVA>`
    + `<ar:FchServDesde>${desde}</ar:FchServDesde><ar:FchServHasta>${hasta}</ar:FchServHasta><ar:FchVtoPago>${vtoPago}</ar:FchVtoPago>`
    + `<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>`
    + `<ar:CondicionIVAReceptorId>${condIva}</ar:CondicionIVAReceptorId>`
    + `</ar:FECAEDetRequest>`;
};

const fechaArca = (yyyymmdd) => {
  const s = String(yyyymmdd || '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
};

/**
 * Autoriza un comprobante: pide el último número, usa el siguiente y solicita el CAE.
 * Devuelve { cae, vencimientoCae, numero, puntoVenta, tipoComprobante, observaciones }.
 */
export const autorizar = async ({ ambiente, auth, comprobante }) => {
  const puntoVenta = Number(comprobante.puntoVenta);
  const tipo = Number(comprobante.tipoComprobante);
  if (!(puntoVenta > 0)) throw new ArcaError('Falta el punto de venta.', { code: 'validacion' });
  // Validamos antes de consumir llamadas a ARCA.
  armarDetalle(comprobante, 1);

  const ultimo = await ultimoAutorizado({ ambiente, auth, puntoVenta, tipoComprobante: tipo });
  const numero = ultimo + 1;
  const req = `${authXml(auth)}<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${puntoVenta}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo></ar:FeCabReq>`
    + `<ar:FeDetReq>${armarDetalle(comprobante, numero)}</ar:FeDetReq></ar:FeCAEReq>`;

  const r = await callWsfe(ambiente, 'FECAESolicitar', req);
  const det = asArray(r?.FeDetResp?.FECAEDetResponse)[0] || {};
  const observaciones = asArray(det?.Observaciones?.Obs).map((o) => ({ codigo: String(o.Code), mensaje: String(o.Msg) }));
  const errores = erroresDe(r);

  if (String(det.Resultado) !== 'A' || !det.CAE) {
    const motivos = [...errores, ...observaciones];
    const authErr = errores.find((e) => ['600', '601', '602'].includes(e.codigo));
    throw new ArcaError(
      authErr ? 'El acceso a ARCA venció o no es válido. Volvé a intentar para renovarlo.'
        : `ARCA rechazó el comprobante${motivos.length ? `: ${motivos.map((m) => `[${m.codigo}] ${m.mensaje}`).join(' · ')}` : '.'}`,
      { code: authErr ? 'auth_expirada' : 'rechazado', detalles: motivos },
    );
  }

  return {
    cae: String(det.CAE),
    vencimientoCae: fechaArca(det.CAEFchVto),
    numero,
    puntoVenta,
    tipoComprobante: tipo,
    fechaEmision: fechaArca(det.CbteFch),
    observaciones,
  };
};
