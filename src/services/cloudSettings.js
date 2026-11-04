// Configuración de la cuenta en la nube (Supabase): perfil, facturación, sedes, obras sociales y plan.
// Se guarda por cuenta, no por navegador: al iniciar sesión en otro dispositivo se recupera igual.
// Si Supabase no está configurado, todo sigue funcionando solo en este navegador.

import { supabase } from '../lib/supabase';

const TABLE = 'user_settings';

/** Campos de la configuración que viajan con la cuenta. */
export const CLOUD_SETTINGS_KEYS = ['config', 'sedes', 'obrasSociales', 'subscription'];

const pick = (obj = {}) =>
  CLOUD_SETTINGS_KEYS.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

const getSessionUser = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
};

/** ¿Hay una sesión en la nube activa para este email? */
export const hasCloudSession = async (email) => {
  const user = await getSessionUser();
  if (!user) return false;
  return !email || (user.email || '').toLowerCase() === String(email).toLowerCase();
};

const esCredencialInvalida = (err) => /invalid login credentials/i.test(err?.message || '');
const esEmailSinConfirmar = (err) => /email not confirmed/i.test(err?.message || '');

/**
 * Abre la sesión en la nube para la cuenta. Si la cuenta todavía no existe en la nube
 * (por ejemplo, se creó antes solo en este navegador) la crea con el mismo email y contraseña.
 * Devuelve { ok, reason, user } — reason: 'no-config' | 'confirm-email' | 'wrong-password' | 'error'.
 */
export const openCloudSession = async ({ email, password, perfil = {}, allowSignUp = true }) => {
  if (!supabase) return { ok: false, reason: 'no-config' };
  const correo = String(email || '').trim().toLowerCase();

  try {
    const signIn = await supabase.auth.signInWithPassword({ email: correo, password });
    if (!signIn.error && signIn.data?.session) return { ok: true, user: signIn.data.user };
    if (esEmailSinConfirmar(signIn.error)) return { ok: false, reason: 'confirm-email' };
    if (!esCredencialInvalida(signIn.error)) return { ok: false, reason: 'error', error: signIn.error };
    if (!allowSignUp) return { ok: false, reason: 'wrong-password' };

    const signUp = await supabase.auth.signUp({ email: correo, password, options: { data: perfil } });
    if (signUp.error) {
      if (/already registered/i.test(signUp.error.message || '')) return { ok: false, reason: 'wrong-password' };
      return { ok: false, reason: 'error', error: signUp.error };
    }
    // Con confirmación por email activada, un email ya registrado vuelve sin identidades.
    if (signUp.data?.user && signUp.data.user.identities?.length === 0) return { ok: false, reason: 'wrong-password' };
    if (signUp.data?.session) return { ok: true, user: signUp.data.user, created: true };
    return { ok: false, reason: 'confirm-email', created: true };
  } catch (error) {
    console.error('No se pudo abrir la sesión en la nube:', error);
    return { ok: false, reason: 'error', error };
  }
};

export const closeCloudSession = async () => {
  if (!supabase) return;
  try { await supabase.auth.signOut(); } catch { /* sin conexión: se limpia al volver */ }
};

/** Trae la configuración guardada de la cuenta. null si no hay sesión o nunca se guardó. */
export const loadCloudSettings = async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const { data, error } = await supabase.from(TABLE).select('data, updated_at').eq('user_id', user.id).maybeSingle();
  if (error) {
    console.error('No se pudo leer la configuración de la cuenta:', error);
    return null;
  }
  return data ? { ...pick(data.data), updatedAt: data.updated_at } : null;
};

const guardar = async (parcial) => {
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: 'no-session' };
  try {
    const actual = await loadCloudSettings();
    const { updatedAt: _omit, ...previo } = actual || {};
    const data = { ...previo, ...pick(parcial) };
    const { error } = await supabase
      .from(TABLE)
      .upsert({ user_id: user.id, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('No se pudo guardar la configuración en la cuenta:', error);
    return { ok: false, reason: 'error', error };
  }
};

// Los guardados se encolan para que dos cambios seguidos (p. ej. perfil y sedes) no se pisen.
let cola = Promise.resolve();

/** Guarda (mezclando con lo que ya había) la configuración de la cuenta. */
export const saveCloudSettings = (parcial) => {
  const tarea = cola.then(() => guardar(parcial));
  cola = tarea.catch(() => {});
  return tarea;
};
