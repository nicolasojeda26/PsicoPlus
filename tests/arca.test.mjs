// Tests del conector ARCA con respuestas simuladas en el formato real de WSFEv1.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autorizar, armarDetalle, ArcaError, setTransporte } from '../server/arcaCore.js';

const env = (inner) => `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
const ultimo = (n) => env(`<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><CbteNro>${n}</CbteNro></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`);
const aprobado = env(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Cuit>20123456786</Cuit><PtoVta>3</PtoVta><CbteTipo>11</CbteTipo><FchProceso>20261104170512</FchProceso><CantReg>1</CantReg><Resultado>A</Resultado><Reproceso>N</Reproceso></FeCabResp><FeDetResp><FECAEDetResponse><Concepto>2</Concepto><DocTipo>96</DocTipo><DocNro>32109845</DocNro><CbteDesde>46</CbteDesde><CbteHasta>46</CbteHasta><CbteFch>20261104</CbteFch><Resultado>A</Resultado><CAE>76449283746512</CAE><CAEFchVto>20261114</CAEFchVto></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`);
const rechazado = env(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Resultado>R</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>R</Resultado><Observaciones><Obs><Code>10246</Code><Msg>Campo Condicion Frente al IVA del receptor es obligatorio</Msg></Obs><Obs><Code>10016</Code><Msg>El numero de comprobante no es correlativo</Msg></Obs></Observaciones><CAE></CAE></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`);

const comprobante = {
  puntoVenta: 3, tipoComprobante: 11, docTipo: 96, docNro: '32.109.845', condicionIvaReceptorId: 5,
  total: 50000, fechaEmision: '2026-11-04', fechaServicioDesde: '2026-11-01', fechaServicioHasta: '2026-11-04', fechaVencimientoPago: '2026-11-14',
};
const auth = { token: 'T', sign: 'S', cuit: '20-12345678-6' };

const mockFetch = (respuestas) => {
  const llamadas = [];
  setTransporte(async (url, opts) => {
    llamadas.push({ url, action: opts.headers.SOAPAction, body: opts.body });
    return { status: 200, text: async () => respuestas.shift() };
  });
  return llamadas;
};

test('autoriza usando el número siguiente al último y devuelve CAE y vencimiento', async () => {
  const llamadas = mockFetch([ultimo(45), aprobado]);
  const r = await autorizar({ ambiente: 'homologacion', auth, comprobante });
  assert.equal(r.cae, '76449283746512');
  assert.equal(r.vencimientoCae, '2026-11-14');
  assert.equal(r.numero, 46);
  assert.equal(r.puntoVenta, 3);
  assert.match(llamadas[0].url, /wswhomo/);
  assert.match(llamadas[1].action, /FECAESolicitar/);
  assert.match(llamadas[1].body, /<ar:CbteDesde>46<\/ar:CbteDesde>/);
  assert.match(llamadas[1].body, /<ar:DocNro>32109845<\/ar:DocNro>/);
  assert.match(llamadas[1].body, /<ar:Cuit>20123456786<\/ar:Cuit>/);
  assert.match(llamadas[1].body, /<ar:CondicionIVAReceptorId>5<\/ar:CondicionIVAReceptorId>/);
});

test('en producción usa los servidores de producción', async () => {
  const llamadas = mockFetch([ultimo(0), aprobado]);
  await autorizar({ ambiente: 'produccion', auth, comprobante });
  assert.match(llamadas[0].url, /servicios1\.afip\.gov\.ar/);
});

test('un rechazo de ARCA se informa con sus códigos', async () => {
  mockFetch([ultimo(45), rechazado]);
  await assert.rejects(autorizar({ ambiente: 'homologacion', auth, comprobante }), (e) => {
    assert.ok(e instanceof ArcaError);
    assert.equal(e.code, 'rechazado');
    assert.match(e.message, /10246/);
    assert.equal(e.detalles.length, 2);
    return true;
  });
});

test('consumidor final sin documento va como DocTipo 99 y DocNro 0', () => {
  const xml = armarDetalle({ ...comprobante, docTipo: 99, docNro: '' }, 1);
  assert.match(xml, /<ar:DocTipo>99<\/ar:DocTipo><ar:DocNro>0<\/ar:DocNro>/);
});

test('los campos salen en el orden del WSDL', () => {
  const xml = armarDetalle(comprobante, 7);
  const orden = ['Concepto', 'DocTipo', 'DocNro', 'CbteDesde', 'CbteHasta', 'CbteFch', 'ImpTotal', 'ImpTotConc', 'ImpNeto', 'ImpOpEx', 'ImpTrib', 'ImpIVA', 'FchServDesde', 'FchServHasta', 'FchVtoPago', 'MonId', 'MonCotiz', 'CondicionIVAReceptorId'];
  const encontrados = [...xml.matchAll(/<ar:(\w+)>/g)].map((m) => m[1]).filter((n) => n !== 'FECAEDetRequest');
  assert.deepEqual(encontrados, orden);
});

test('valida antes de llamar a ARCA', async () => {
  const llamadas = mockFetch([]);
  await assert.rejects(autorizar({ ambiente: 'homologacion', auth, comprobante: { ...comprobante, condicionIvaReceptorId: null } }), /condición frente al IVA/);
  await assert.rejects(autorizar({ ambiente: 'homologacion', auth, comprobante: { ...comprobante, fechaVencimientoPago: '2026-11-01' } }), /vencimiento de pago/);
  await assert.rejects(autorizar({ ambiente: 'homologacion', auth, comprobante: { ...comprobante, total: 0 } }), /mayor a \$0/);
  assert.equal(llamadas.length, 0);
});

test('nota de crédito C lleva el comprobante asociado después de la condición de IVA', () => {
  const xml = armarDetalle({ ...comprobante, tipoComprobante: 13, comprobanteAsociado: { tipo: 11, puntoVenta: 2, numero: 1, cuit: '30-68303222-7', fecha: '2026-11-04' } }, 1);
  assert.match(xml, /<\/ar:CondicionIVAReceptorId><ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>11<\/ar:Tipo><ar:PtoVta>2<\/ar:PtoVta><ar:Nro>1<\/ar:Nro><ar:Cuit>30683032227<\/ar:Cuit><ar:CbteFch>20261104<\/ar:CbteFch><\/ar:CbteAsoc><\/ar:CbtesAsoc>/);
  assert.throws(() => armarDetalle({ ...comprobante, tipoComprobante: 13 }, 1), /factura que anula/);
});
