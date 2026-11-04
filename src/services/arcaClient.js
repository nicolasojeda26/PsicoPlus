// Cliente de ARCA en el navegador: guarda el certificado del profesional en este dispositivo,
// reutiliza el acceso (token) mientras esté vigente y llama a /api/arca para autorizar comprobantes.

import { validarCuit, formatearNumeroComprobante } from './arcaService';

const CRED_KEY = 'psicoplus_arca_cred_v1';
const TA_KEY = 'psicoplus_arca_ta_v1';

const leer = (k) => {
  try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
};
const guardar = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
};

const soloDigitos = (v) => String(v || '').replace(/\D/g, '');

export const getArcaCredenciales = () => leer(CRED_KEY);

export const saveArcaCredenciales = ({ cert, key }) => {
  guardar(CRED_KEY, { cert, key, cargadoEl: new Date().toISOString() });
  guardar(TA_KEY, {}); // un certificado nuevo invalida los accesos anteriores
};

export const borrarArcaCredenciales = () => {
  try {
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(TA_KEY);
  } catch { /* nada */ }
};

export const tieneCredencialesArca = () => {
  const c = getArcaCredenciales();
  return Boolean(c?.cert && c?.key);
};

const llamarApi = async (payload) => {
  let res;
  try {
    res = await fetch('/api/arca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw Object.assign(new Error('No hay conexión con el servidor de facturación. Revisá tu internet.'), { code: 'red' });
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw Object.assign(new Error('El servidor de facturación no respondió correctamente.'), { code: 'respuesta' });
  }
  if (!data.ok) {
    throw Object.assign(new Error(data.error || 'Error al hablar con ARCA.'), { code: data.code, detalles: data.detalles });
  }
  return data;
};

const claveTicket = (ambiente, cuit) => `${ambiente}:${soloDigitos(cuit)}`;

/** Devuelve { token, sign, cuit } reutilizando el acceso guardado si sigue vigente. */
export const obtenerAcceso = async ({ ambiente, cuit, forzar = false }) => {
  const cuitDig = soloDigitos(cuit);
  const tickets = leer(TA_KEY) || {};
  const k = claveTicket(ambiente, cuitDig);
  const guardado = tickets[k];
  const margen = 5 * 60 * 1000;
  if (!forzar && guardado?.token && new Date(guardado.expiracion).getTime() - margen > Date.now()) {
    return { token: guardado.token, sign: guardado.sign, cuit: cuitDig };
  }

  const cred = getArcaCredenciales();
  if (!cred?.cert || !cred?.key) {
    throw Object.assign(new Error('Primero cargá tu certificado y clave de ARCA en Configuración → Integración Fiscal ARCA.'), { code: 'sin_certificado' });
  }

  const data = await llamarApi({ accion: 'login', ambiente, cert: cred.cert, key: cred.key });
  const certCuit = soloDigitos(data.certificado?.cuit);
  if (certCuit && certCuit !== cuitDig) {
    throw Object.assign(
      new Error(`El certificado cargado es del CUIT ${certCuit}, pero en tu configuración figura ${cuitDig}. Tienen que coincidir.`),
      { code: 'cuit_distinto' },
    );
  }
  tickets[k] = { token: data.token, sign: data.sign, expiracion: data.expiracion };
  guardar(TA_KEY, tickets);
  return { token: data.token, sign: data.sign, cuit: cuitDig };
};

const conAcceso = async ({ ambiente, cuit }, fn) => {
  const auth = await obtenerAcceso({ ambiente, cuit });
  try {
    return await fn(auth);
  } catch (e) {
    if (e.code === 'auth_expirada') {
      return fn(await obtenerAcceso({ ambiente, cuit, forzar: true }));
    }
    throw e;
  }
};

const validarEmisor = (config) => {
  const ambiente = config?.ambienteArca === 'produccion' ? 'produccion' : 'homologacion';
  const val = validarCuit(config?.cuit);
  if (!val.valido) {
    throw Object.assign(new Error(`Revisá el CUIT de tu configuración: ${val.error}.`), { code: 'cuit_invalido' });
  }
  const puntoVenta = parseInt(soloDigitos(config?.puntoVenta), 10);
  if (!(puntoVenta > 0)) {
    throw Object.assign(new Error('Configurá el punto de venta de ARCA (el que creaste para "Factura Electrónica - Web Services").'), { code: 'sin_punto_venta' });
  }
  return { ambiente, cuit: soloDigitos(config.cuit), puntoVenta };
};

/** Verifica servidores, certificado y puntos de venta habilitados. */
export const probarConexionArca = async (config) => {
  const { ambiente, cuit, puntoVenta } = validarEmisor(config);
  const estado = await llamarApi({ accion: 'estado', ambiente });
  const { puntosVenta } = await conAcceso({ ambiente, cuit }, (auth) => llamarApi({ accion: 'puntosVenta', ambiente, auth }));
  const pv = puntosVenta.find((p) => p.numero === puntoVenta);
  return { ambiente, servidores: estado.servidores, puntosVenta, puntoVentaOk: Boolean(pv && !pv.bloqueado && !pv.baja) };
};

/**
 * Autoriza un comprobante en ARCA.
 * comprobante: { tipoComprobante (código), docTipo, docNro, condicionIvaReceptorId, total,
 *                fechaEmision, fechaServicioDesde, fechaServicioHasta, fechaVencimientoPago }
 */
export const autorizarComprobanteArca = async ({ config, comprobante }) => {
  const { ambiente, cuit, puntoVenta } = validarEmisor(config);
  const r = await conAcceso({ ambiente, cuit }, (auth) => llamarApi({
    accion: 'autorizar', ambiente, auth, comprobante: { ...comprobante, puntoVenta },
  }));
  return {
    ambiente,
    cae: r.cae,
    vencimientoCae: r.vencimientoCae,
    puntoVenta: r.puntoVenta,
    numero: r.numero,
    numeroFactura: formatearNumeroComprobante(r.puntoVenta, r.numero),
    tipoComprobanteCodigo: r.tipoComprobante,
    observaciones: r.observaciones || [],
  };
};
