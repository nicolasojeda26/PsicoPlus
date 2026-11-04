import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHorarioTexto, generarSlots, proximasFechas, describirHorario } from '../src/lib/agendaPortal.js';

test('interpreta el texto de días y horarios de una sede', () => {
  assert.deepEqual(parseHorarioTexto('Martes y Jueves (14:00 - 20:00)'), { dias: [2, 4], desde: '14:00', hasta: '20:00' });
  assert.deepEqual(parseHorarioTexto('Lunes a Viernes 9 a 18 hs'), { dias: [1, 2, 3, 4, 5], desde: '09:00', hasta: '18:00' });
  assert.deepEqual(parseHorarioTexto('Miércoles (09:00 - 14:00)'), { dias: [3], desde: '09:00', hasta: '14:00' });
  assert.equal(parseHorarioTexto(''), null);
});

const sede = { id: 's1', horario: { dias: [2, 4], desde: '14:00', hasta: '17:00' } };
const antes = new Date('2026-11-01T10:00:00');

test('solo ofrece horarios los días que atiende la sede', () => {
  assert.deepEqual(generarSlots({ sede, fecha: '2026-11-09', ahora: antes }), []); // lunes
  const martes = generarSlots({ sede, fecha: '2026-11-10', ahora: antes });
  assert.deepEqual(martes.map(s => s.hora), ['14:00', '14:45', '15:30', '16:15']);
});

test('marca ocupados los horarios que se superponen con turnos de cualquier sede', () => {
  const turnos = [
    { fecha: '2026-11-10', horaInicio: '15:00', horaFin: '15:45', estado: 'Confirmado', sedeId: 'otra' },
    { fecha: '2026-11-10', horaInicio: '16:15', horaFin: '17:00', estado: 'Cancelado' },
  ];
  const slots = generarSlots({ sede, fecha: '2026-11-10', turnos, ahora: antes });
  assert.deepEqual(slots.filter(s => s.ocupado).map(s => s.hora), ['14:45', '15:30']);
});

test('no ofrece horarios que ya pasaron', () => {
  const slots = generarSlots({ sede, fecha: '2026-11-10', ahora: new Date('2026-11-10T15:00:00') });
  assert.deepEqual(slots.map(s => s.hora), ['15:30', '16:15']);
});

test('próximas fechas con atención y descripción', () => {
  assert.deepEqual(proximasFechas(sede, 3, new Date('2026-11-09T12:00:00')), ['2026-11-10', '2026-11-12', '2026-11-17']);
  assert.equal(describirHorario(sede.horario), 'Mar y Jue · 14:00 a 17:00');
});
