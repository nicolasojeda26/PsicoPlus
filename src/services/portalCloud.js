// Portal de pacientes en la nube: el profesional publica sus sedes, horarios y horarios ocupados
// (sin datos de pacientes) y los pacientes envían solicitudes de turno que le llegan a su cuenta.

import { supabase } from '../lib/supabase';
import { todayISO } from '../lib/dates';

/** Id de la cuenta en la nube del profesional con sesión iniciada (para armar el link). */
export const getPortalId = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
};

export const portalUrl = (portalId) => {
  // El link sale con el dominio desde donde se abrió la app (psicoplus.net.ar en producción).
  const base = `${window.location.origin}/?portal=paciente`;
  return portalId ? `${base}&p=${portalId}` : base;
};

/** Lo mínimo que necesita el portal, sin nombres ni datos de pacientes. */
export const armarDatosPortal = ({ config = {}, sedes = [], obrasSociales = [], turnos = [] }) => {
  const hoy = todayISO();
  return {
    config: {
      nombre: config.nombre,
      titulo: config.titulo,
      matriculaProvincial: config.matriculaProvincial,
      telefono: config.telefono,
      portalMensajeBienvenida: config.portalMensajeBienvenida,
      duracionTurnoMinutos: config.duracionTurnoMinutos || 45,
    },
    sedes: sedes.map(({ id, nombre, direccion, diasAtencion, horario, icono, color }) => ({
      id, nombre, direccion, diasAtencion, horario, icono, color,
    })),
    obrasSociales: obrasSociales.map(({ id, nombre, sigla, coseguroRecomendado }) => ({ id, nombre, sigla, coseguroRecomendado })),
    ocupados: turnos
      .filter(t => t.fecha >= hoy && t.estado !== 'Cancelado' && t.horaInicio)
      .map(({ fecha, horaInicio, horaFin, sedeId }) => ({ fecha, horaInicio, horaFin, sedeId })),
  };
};

let ultimoPublicado = '';

export const publicarPortal = async (datos) => {
  const id = await getPortalId();
  if (!id) return { ok: false, reason: 'no-session' };
  const json = JSON.stringify(datos);
  if (json === ultimoPublicado) return { ok: true, sinCambios: true };
  const { error } = await supabase
    .from('portal_publico')
    .upsert({ user_id: id, data: datos, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    console.error('No se pudo publicar el portal de pacientes:', error);
    return { ok: false, reason: 'error', error };
  }
  ultimoPublicado = json;
  return { ok: true };
};

/** Lo que ve el paciente al abrir el link. */
export const cargarPortal = async (portalId) => {
  if (!supabase || !portalId) return null;
  const { data, error } = await supabase.from('portal_publico').select('data').eq('user_id', portalId).maybeSingle();
  if (error) {
    console.error('No se pudo cargar el portal:', error);
    throw error;
  }
  return data?.data || null;
};

export const enviarSolicitud = async (portalId, turno) => {
  if (!supabase) throw new Error('El portal no está disponible en este momento.');
  const { error } = await supabase.from('portal_solicitudes').insert({ profesional_id: portalId, turno });
  if (error) throw error;
};

/** Solicitudes nuevas que hicieron los pacientes (las devuelve y las borra de la nube). */
export const recibirSolicitudes = async () => {
  const id = await getPortalId();
  if (!id) return [];
  const { data, error } = await supabase
    .from('portal_solicitudes')
    .select('id, turno, created_at')
    .eq('profesional_id', id)
    .order('created_at', { ascending: true });
  if (error || !data?.length) return [];
  return data;
};

export const borrarSolicitudes = async (ids) => {
  if (!supabase || !ids.length) return;
  await supabase.from('portal_solicitudes').delete().in('id', ids);
};
