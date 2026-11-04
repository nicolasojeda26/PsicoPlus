// Función de Vercel: puente entre PsicoPlus y los web services de ARCA.
// POST /api/arca  { accion, ambiente, ... }
//   accion "estado"        → verifica que ARCA responda (FEDummy)
//   accion "login"         → { cert, key } → { token, sign, expiracion, certificado }
//   accion "puntosVenta"   → { auth }      → lista de puntos de venta
//   accion "ultimo"        → { auth, puntoVenta, tipoComprobante } → último número autorizado
//   accion "autorizar"     → { auth, comprobante } → CAE
// No se guarda nada: certificado, clave y token llegan en cada pedido.

import {
  ArcaError, dummy, loginWsaa, leerCertificado, puntosDeVenta, ultimoAutorizado, autorizar,
} from '../server/arcaCore.js';

const validarAuth = (auth) => {
  if (!auth?.token || !auth?.sign || !auth?.cuit) {
    throw new ArcaError('Falta el acceso a ARCA (token/sign/CUIT).', { code: 'auth_faltante' });
  }
  return auth;
};

export const procesar = async (body = {}) => {
  const { accion, ambiente = 'homologacion' } = body;
  switch (accion) {
    case 'estado':
      return { servidores: await dummy(ambiente) };
    case 'login': {
      const ta = await loginWsaa({ ambiente, cert: body.cert, key: body.key });
      return { ...ta, certificado: leerCertificado(body.cert) };
    }
    case 'puntosVenta':
      return { puntosVenta: await puntosDeVenta({ ambiente, auth: validarAuth(body.auth) }) };
    case 'ultimo':
      return {
        numero: await ultimoAutorizado({
          ambiente, auth: validarAuth(body.auth), puntoVenta: body.puntoVenta, tipoComprobante: body.tipoComprobante,
        }),
      };
    case 'autorizar':
      return await autorizar({ ambiente, auth: validarAuth(body.auth), comprobante: body.comprobante || {} });
    default:
      throw new ArcaError('Acción desconocida.', { code: 'accion' });
  }
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Usá POST.' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const data = await procesar(body);
    res.status(200).json({ ok: true, ...data });
  } catch (e) {
    if (e instanceof ArcaError) {
      res.status(e.status || 400).json({ ok: false, error: e.message, code: e.code, detalles: e.detalles });
    } else {
      console.error('Error inesperado en /api/arca:', e);
      res.status(500).json({ ok: false, error: 'Error interno al hablar con ARCA.' });
    }
  }
}
