// Cálculo de liquidaciones a obras sociales a partir de los turnos atendidos en la Agenda.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_LABEL = MESES.map((m) => m[0].toUpperCase() + m.slice(1));

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Estados de turno que cuentan como sesión prestada y facturable. */
export const ESTADOS_FACTURABLES = ['Atendido'];

/** "2026-11" → "Noviembre 2026" */
export const mesALabel = (yyyyMm) => {
  const m = String(yyyyMm || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  return `${MESES_LABEL[parseInt(m[2], 10) - 1]} ${m[1]}`;
};

/** "Noviembre 2026" o "2026-11" → "2026-11" (o null si no se entiende). */
export const labelAMes = (label) => {
  const txt = sinAcentos(label);
  const iso = txt.match(/^(\d{4})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const m = txt.match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const idx = MESES.indexOf(m[1] === 'setiembre' ? 'septiembre' : m[1]);
  return idx === -1 ? null : `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
};

/**
 * Sesiones atendidas en el mes para una obra social.
 * Devuelve { detalle: [{ pacienteId, nombre, dni, numeroAfiliado, numeroOrden, sesiones, fechas }], totalSesiones }.
 */
export const sesionesDelPeriodo = ({ turnos = [], pacientes = [], obraSocialId, mes }) => {
  const pacientesOS = new Map(pacientes.filter((p) => p.obraSocialId === obraSocialId).map((p) => [p.id, p]));
  const porPaciente = new Map();
  for (const t of turnos) {
    if (!pacientesOS.has(t.pacienteId)) continue;
    if (!ESTADOS_FACTURABLES.includes(t.estado)) continue;
    if (String(t.fecha || '').slice(0, 7) !== mes) continue;
    const fechas = porPaciente.get(t.pacienteId) || [];
    fechas.push(t.fecha);
    porPaciente.set(t.pacienteId, fechas);
  }
  const detalle = [...porPaciente.entries()].map(([pacienteId, fechas]) => {
    const p = pacientesOS.get(pacienteId);
    return {
      pacienteId,
      nombre: p.nombreCompleto,
      dni: p.dni || '',
      numeroAfiliado: p.numeroAfiliado || '',
      numeroOrden: p.numeroOrden || '',
      sesiones: fechas.length,
      fechas: fechas.sort(),
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { detalle, totalSesiones: detalle.reduce((acc, d) => acc + d.sesiones, 0) };
};

/** ¿Ya hay una liquidación de esa obra social para ese mes? */
export const liquidacionExistente = (liquidaciones = [], obraSocialId, mes) =>
  liquidaciones.find((l) => l.obraSocialId === obraSocialId && (l.mes || labelAMes(l.periodo)) === mes) || null;

/** Arma la liquidación lista para guardar, o devuelve { error } si no corresponde. */
export const armarLiquidacion = ({ obraSocial, turnos, pacientes, liquidaciones, mes, observaciones = '', idSufijo = '' }) => {
  if (!obraSocial) return { error: 'Elegí una obra social.' };
  if (!mes) return { error: 'Elegí el período.' };
  if (!(obraSocial.arancelSesion > 0)) return { error: `Falta cargar el arancel por sesión de ${obraSocial.sigla || obraSocial.nombre}.` };
  const periodo = mesALabel(mes);
  if (liquidacionExistente(liquidaciones, obraSocial.id, mes)) {
    return { error: `Ya existe una liquidación de ${obraSocial.sigla || obraSocial.nombre} para ${periodo}. Borrala primero si querés regenerarla.` };
  }
  const { detalle, totalSesiones } = sesionesDelPeriodo({ turnos, pacientes, obraSocialId: obraSocial.id, mes });
  if (!totalSesiones) {
    return { error: `No hay turnos marcados como "Atendido" de pacientes de ${obraSocial.sigla || obraSocial.nombre} en ${periodo}.` };
  }
  return {
    liquidacion: {
      id: `liq-${Date.now()}${idSufijo}`,
      obraSocialId: obraSocial.id,
      periodo,
      mes,
      fechaPresentacion: new Date().toISOString().split('T')[0],
      cantidadSesiones: totalSesiones,
      arancelSesion: obraSocial.arancelSesion,
      montoBruto: totalSesiones * obraSocial.arancelSesion,
      detalle,
      estado: 'Presentada',
      observaciones: observaciones || `Presentación de ${periodo} para ${obraSocial.nombre}.`,
    },
  };
};
