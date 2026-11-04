// Disponibilidad del portal de pacientes: qué días y horarios atiende cada sede
// y qué turnos quedan libres en una fecha.

export const DIAS_SEMANA = [
  { n: 1, corto: 'Lun', largo: 'Lunes' },
  { n: 2, corto: 'Mar', largo: 'Martes' },
  { n: 3, corto: 'Mié', largo: 'Miércoles' },
  { n: 4, corto: 'Jue', largo: 'Jueves' },
  { n: 5, corto: 'Vie', largo: 'Viernes' },
  { n: 6, corto: 'Sáb', largo: 'Sábado' },
  { n: 0, corto: 'Dom', largo: 'Domingo' },
];

export const HORARIO_POR_DEFECTO = { dias: [1, 2, 3, 4, 5], desde: '09:00', hasta: '20:00' };

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const NOMBRES = [
  ['lunes', 1], ['martes', 2], ['miercoles', 3], ['jueves', 4], ['viernes', 5], ['sabado', 6], ['domingo', 0],
];

const ORDEN = [1, 2, 3, 4, 5, 6, 0];

/** Interpreta textos como "Martes y Jueves (14:00 - 20:00)" o "Lunes a Viernes 9 a 18". */
export const parseHorarioTexto = (texto) => {
  const t = sinAcentos(texto);
  if (!t.trim()) return null;

  let dias = [];
  const rango = t.match(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+a\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/);
  if (rango) {
    const ini = ORDEN.indexOf(NOMBRES.find(([n]) => n === rango[1])[1]);
    const fin = ORDEN.indexOf(NOMBRES.find(([n]) => n === rango[2])[1]);
    if (ini <= fin) dias = ORDEN.slice(ini, fin + 1);
  }
  for (const [nombre, n] of NOMBRES) {
    if (t.includes(nombre) && !dias.includes(n)) dias.push(n);
  }

  const horas = [...t.matchAll(/(\d{1,2})(?:[:.h](\d{2}))?\s*(?:hs?)?/g)]
    .map(m => ({ h: Number(m[1]), m: Number(m[2] || 0) }))
    .filter(x => x.h <= 24 && x.m < 60);
  const fmt = ({ h, m }) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  if (!dias.length && horas.length < 2) return null;
  return {
    dias: dias.length ? dias.sort((a, b) => ORDEN.indexOf(a) - ORDEN.indexOf(b)) : HORARIO_POR_DEFECTO.dias,
    desde: horas.length >= 2 ? fmt(horas[0]) : HORARIO_POR_DEFECTO.desde,
    hasta: horas.length >= 2 ? fmt(horas[1]) : HORARIO_POR_DEFECTO.hasta,
  };
};

/** Horario estructurado de la sede (o el que se deduce del texto "Días y horarios"). */
export const horarioDeSede = (sede) => {
  const h = sede?.horario;
  if (h && Array.isArray(h.dias) && h.desde && h.hasta) return h;
  return parseHorarioTexto(sede?.diasAtencion) || HORARIO_POR_DEFECTO;
};

/** "Lun, Mié y Vie · 09:00 a 14:00" */
export const describirHorario = (horario) => {
  const dias = ORDEN.filter(n => horario.dias.includes(n)).map(n => DIAS_SEMANA.find(d => d.n === n).corto);
  const lista = dias.length > 1 ? `${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}` : (dias[0] || 'Sin días');
  return `${lista} · ${horario.desde} a ${horario.hasta}`;
};

const aMin = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};
const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const diaDeSemana = (fechaISO) => new Date(`${fechaISO}T12:00:00`).getDay();

/** ¿La sede atiende ese día? */
export const atiendeEseDia = (sede, fechaISO) => horarioDeSede(sede).dias.includes(diaDeSemana(fechaISO));

/**
 * Turnos de la sede para una fecha: [{ hora, ocupado }].
 * Un horario queda ocupado si se superpone con cualquier turno no cancelado de ese día
 * (en cualquier sede: el profesional no puede estar en dos lugares a la vez).
 */
export const generarSlots = ({ sede, fecha, duracion = 45, turnos = [], ahora = new Date() }) => {
  if (!sede || !fecha || !atiendeEseDia(sede, fecha)) return [];
  const { desde, hasta } = horarioDeSede(sede);
  const dur = Number(duracion) > 0 ? Number(duracion) : 45;

  const delDia = turnos
    .filter(t => t.fecha === fecha && t.estado !== 'Cancelado' && t.horaInicio)
    .map(t => ({ ini: aMin(t.horaInicio), fin: t.horaFin ? aMin(t.horaFin) : aMin(t.horaInicio) + dur }));

  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();

  const slots = [];
  for (let ini = aMin(desde); ini + dur <= aMin(hasta); ini += dur) {
    const fin = ini + dur;
    if (fecha < hoy || (fecha === hoy && ini <= minAhora)) continue;
    const ocupado = delDia.some(t => ini < t.fin && t.ini < fin);
    slots.push({ hora: aHora(ini), ocupado });
  }
  return slots;
};

/** Próximas fechas (desde mañana) en que la sede atiende. */
export const proximasFechas = (sede, cantidad = 6, desde = new Date()) => {
  const out = [];
  for (let i = 1; out.length < cantidad && i <= 60; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i, 12);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (atiendeEseDia(sede, iso)) out.push(iso);
  }
  return out;
};

export const finDeTurno = (hora, duracion = 45) => aHora(aMin(hora) + (Number(duracion) > 0 ? Number(duracion) : 45));
