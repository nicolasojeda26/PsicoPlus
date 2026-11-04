import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarLiquidacion, sesionesDelPeriodo, labelAMes, mesALabel } from '../src/lib/liquidaciones.js';

const pacientes = [
  { id: 'p1', nombreCompleto: 'Ana Pérez', obraSocialId: 'ioscor', sesionesConsumidas: 9 },
  { id: 'p2', nombreCompleto: 'Beto Gómez', obraSocialId: 'ioscor', sesionesConsumidas: 0 },
  { id: 'p3', nombreCompleto: 'Caro Ruiz', obraSocialId: 'osde' },
];
const turnos = [
  { pacienteId: 'p1', fecha: '2026-11-03', estado: 'Atendido' },
  { pacienteId: 'p1', fecha: '2026-11-10', estado: 'Atendido' },
  { pacienteId: 'p1', fecha: '2026-11-17', estado: 'Ausente sin aviso' },
  { pacienteId: 'p1', fecha: '2026-10-27', estado: 'Atendido' },
  { pacienteId: 'p2', fecha: '2026-11-20', estado: 'Confirmado' },
  { pacienteId: 'p3', fecha: '2026-11-05', estado: 'Atendido' },
];
const ioscor = { id: 'ioscor', nombre: 'IOSCOR', sigla: 'IOSCOR', arancelSesion: 18500 };

test('cuenta solo turnos atendidos del mes y de esa obra social', () => {
  const r = sesionesDelPeriodo({ turnos, pacientes, obraSocialId: 'ioscor', mes: '2026-11' });
  assert.equal(r.totalSesiones, 2);
  assert.equal(r.detalle.length, 1);
  assert.deepEqual(r.detalle[0].fechas, ['2026-11-03', '2026-11-10']);
});

test('un paciente sin sesiones no suma (antes contaba como 1)', () => {
  const { liquidacion } = armarLiquidacion({ obraSocial: ioscor, turnos, pacientes, liquidaciones: [], mes: '2026-11' });
  assert.equal(liquidacion.cantidadSesiones, 2);
  assert.equal(liquidacion.montoBruto, 37000);
  assert.equal(liquidacion.periodo, 'Noviembre 2026');
});

test('no permite duplicar la liquidación del mismo mes, aunque esté guardada con el formato viejo', () => {
  const r = armarLiquidacion({ obraSocial: ioscor, turnos, pacientes, liquidaciones: [{ obraSocialId: 'ioscor', periodo: 'Noviembre 2026' }], mes: '2026-11' });
  assert.match(r.error, /Ya existe/);
});

test('sin sesiones o sin arancel no genera nada', () => {
  assert.match(armarLiquidacion({ obraSocial: ioscor, turnos, pacientes, liquidaciones: [], mes: '2026-09' }).error, /No hay turnos/);
  assert.match(armarLiquidacion({ obraSocial: { ...ioscor, arancelSesion: 0 }, turnos, pacientes, liquidaciones: [], mes: '2026-11' }).error, /arancel/);
});

test('convierte períodos', () => {
  assert.equal(labelAMes('Septiembre 2026'), '2026-09');
  assert.equal(labelAMes('setiembre 2026'), '2026-09');
  assert.equal(mesALabel('2026-02'), 'Febrero 2026');
});
