// Servicio de gestión de suscripción y límites para PsicoPlus

export const PLANS = {
  FREE: 'free',
  PRO: 'pro',
};

export const PLAN_LIMITS = {
  [PLANS.FREE]: {
    maxPacientes: 15,
    maxSedes: 1,
    permitirLiquidacionMasiva: false,
    permitirReportesAvanzados: false,
    permitirPortalPersonalizado: false,
    permitirInformesClinicosPDF: false,
    permitirExportacionExcel: false,
    nombre: 'Plan Inicial (Gratuito)',
    precioMensual: 0,
    precioAnual: 0,
  },
  [PLANS.PRO]: {
    maxPacientes: Infinity,
    maxSedes: Infinity,
    permitirLiquidacionMasiva: true,
    permitirReportesAvanzados: true,
    permitirPortalPersonalizado: true,
    permitirInformesClinicosPDF: true,
    permitirExportacionExcel: true,
    nombre: 'Plan PRO Ilimitado',
    precioMensual: 8000, // ARS por mes
    precioAnual: 60000, // ARS por año (equivale a $5.000/mes)
  }
};

/** Precios PRO (ARS). Cambiarlos acá actualiza la landing y el modal de suscripción. */
export const PRO_PRICING = {
  monthly: { total: 8000, perMonth: 8000, label: 'Mensual' },
  annual: { total: 60000, perMonth: 5000, label: 'Anual' },
};
export const ANNUAL_SAVINGS = PRO_PRICING.monthly.perMonth * 12 - PRO_PRICING.annual.total; // 36.000
export const ANNUAL_DISCOUNT_PCT = Math.floor((ANNUAL_SAVINGS / (PRO_PRICING.monthly.perMonth * 12)) * 100); // 37

/** Datos de cobro (transferencia a Mercado Pago). */
export const PAYMENT_INFO = {
  provider: 'Mercado Pago',
  alias: 'nico.adolfo.mp',
  cvu: '0000003100004965726450',
  // WhatsApp donde se reciben los comprobantes (formato internacional, sin +). CONFIRMAR NÚMERO.
  whatsapp: '5493794021813',
};

export const formatARS = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

export const PROMO_CODES = {
  'LANZAMIENTO2026': { plan: PLANS.PRO, dias: 365, descripcion: 'Acceso PRO 1 Año Bonificado (Lanzamiento)' },
  'COLEGIOPSICO': { plan: PLANS.PRO, dias: 180, descripcion: 'Convenio Colegio de Psicólogos (6 meses PRO)' },
  'PROMOVIP': { plan: PLANS.PRO, dias: 365, descripcion: 'Membresía PRO VIP' },
  'PSICOPLUSPRO': { plan: PLANS.PRO, dias: 365, descripcion: 'Código Oficial de Activación PRO' },
  'DEMOPRO': { plan: PLANS.PRO, dias: 30, descripcion: 'Prueba PRO 30 Días' },
};

/** Suscripción permanente para cuentas con acceso total (user.fullAccess). */
export const FULL_ACCESS_SUBSCRIPTION = {
  plan: PLANS.PRO,
  descripcion: 'Acceso total (cuenta habilitada)',
  codigoAplicado: null,
  expiraEn: null,
};

/** Devuelve la suscripción que corresponde al usuario actual. */
export const getEffectiveSubscription = (user, storedSubscription) =>
  user?.fullAccess ? FULL_ACCESS_SUBSCRIPTION : storedSubscription;

const STORAGE_KEY_SUB = 'psicoplus_subscription_v1';

export const getSubscriptionData = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY_SUB));
    if (data && data.plan) {
      // Check expiry if any
      if (data.expiraEn && new Date(data.expiraEn) < new Date()) {
        return { plan: PLANS.FREE, motivoExpiracion: 'Tu suscripción PRO ha expirado.' };
      }
      return data;
    }
  } catch (e) {
    console.error('Error al leer suscripción:', e);
  }

  // Default is FREE plan
  return {
    plan: PLANS.FREE,
    fechaInicio: new Date().toISOString(),
    codigoAplicado: null,
  };
};

export const saveSubscriptionData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY_SUB, JSON.stringify(data));
  } catch (e) {
    console.error('Error al guardar suscripción:', e);
  }
};

export const activatePromoCode = (rawCode) => {
  const code = (rawCode || '').trim().toUpperCase();
  const promo = PROMO_CODES[code];
  if (!promo) {
    return { success: false, error: 'Código de activación inválido o no reconocido.' };
  }

  const expiraEn = new Date();
  expiraEn.setDate(expiraEn.getDate() + promo.dias);

  const newSub = {
    plan: promo.plan,
    codigoAplicado: code,
    descripcion: promo.descripcion,
    fechaActivacion: new Date().toISOString(),
    expiraEn: expiraEn.toISOString(),
  };

  saveSubscriptionData(newSub);
  return { success: true, subscription: newSub, promo };
};

export const switchPlanDirectly = (planName) => {
  const newSub = {
    plan: planName === PLANS.PRO ? PLANS.PRO : PLANS.FREE,
    fechaActivacion: new Date().toISOString(),
    descripcion: planName === PLANS.PRO ? 'Suscripción PRO Activa' : 'Plan Gratuito Activo',
    expiraEn: planName === PLANS.PRO ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString() : null,
  };
  saveSubscriptionData(newSub);
  return newSub;
};

export const checkFeatureAccess = (featureName, subData = null) => {
  const sub = subData || getSubscriptionData();
  const isPro = sub.plan === PLANS.PRO;
  return isPro;
};
