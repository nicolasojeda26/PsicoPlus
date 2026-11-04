import { SITE_URL } from '../lib/site';

// Utilidades de WhatsApp para Argentina (formateo de números y plantillas)

export const formatArgentinaPhoneForWhatsapp = (phone) => {
  if (!phone) return '';
  // Quitar espacios, guiones, paréntesis y signos +
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // Si ya tiene el +549 o 549, limpiar el +
  if (cleaned.startsWith('+549')) {
    return cleaned.replace('+', '');
  }
  if (cleaned.startsWith('549')) {
    return cleaned;
  }
  if (cleaned.startsWith('+54')) {
    return '549' + cleaned.replace('+54', '');
  }
  if (cleaned.startsWith('54')) {
    return '549' + cleaned.substring(2);
  }
  // Si empieza con 0 o 15 (formato local argentino ej: 0379 154551289)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.includes('15') && cleaned.length >= 10) {
    // Reemplazar el 15 si es celular
    cleaned = cleaned.replace('15', '');
  }
  return '549' + cleaned;
};

export const generateWhatsappLink = (phone, message) => {
  const cleanPhone = formatArgentinaPhoneForWhatsapp(phone);
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
};

export const createReminderMessage = (template, { pacienteNombre, dia, hora, sedeNombre, modalidad, linkOnline }) => {
  let text = template || '¡Hola {nombre}! Te recuerdo nuestro turno de psicología el {dia} a las {hora} hs en {sede}. Por favor, confirmá tu asistencia. ¡Saludos!';
  
  text = text.replace('{nombre}', pacienteNombre || 'estimado/a');
  text = text.replace('{dia}', dia || 'el día acordado');
  text = text.replace('{hora}', hora || '');
  
  if (modalidad === 'Online' && linkOnline) {
    text = text.replace('{sede}', `modalidad Online por videollamada (${linkOnline})`);
  } else {
    text = text.replace('{sede}', sedeNombre || 'el consultorio');
  }

  return text;
};

export const createOrderAlertMessage = (template, { pacienteNombre, obraSocialNombre, sesionesRestantes, sesionesDisponibles } = {}) => {
  let text = template || '¡Hola {nombre}! Te comento que te quedan {restantes} sesiones de tu orden médica de {obra_social}. Te sugiero solicitar un nuevo pedido a tu médico. ¡Gracias!';
  const count = sesionesRestantes !== undefined ? sesionesRestantes : sesionesDisponibles !== undefined ? sesionesDisponibles : 0;
  
  text = text.replace('{nombre}', pacienteNombre || 'estimado/a');
  text = text.replace('{obra_social}', obraSocialNombre || 'tu obra social');
  text = text.replace('{restantes}', count.toString());

  return text;
};

export const createFacturaNotificationMessage = ({ config, factura, pacienteNombre }) => {
  const profesional = config?.nombre || 'Lic. Virna Toledo';
  const totalStr = Number(factura.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
  const numero = factura.numeroFactura || '0001';
  const tipo = factura.tipoComprobante || 'Factura';

  return `¡Hola ${pacienteNombre || ''}! Te saluda ${profesional}. Adjunto tu comprobante ${tipo} Nº ${numero} correspondiente a tus sesiones de psicología por un total de $${totalStr}. ¡Muchas gracias!`;
};

export const createTurnoConfirmadoMessage = ({ config, pacienteNombre, dia, hora, sedeNombre, modalidad, linkOnline }) => {
  const profesional = config?.nombre || 'Lic. Virna Toledo';
  let lugar = sedeNombre || 'el consultorio';
  if (modalidad === 'Online' && linkOnline) {
    lugar = `Online vía Meet (${linkOnline})`;
  }

  return `¡Hola ${pacienteNombre || ''}! Te confirmo tu turno de atención psicológica con ${profesional} para el día ${dia} a las ${hora} hs en ${lugar}. ¡Nos vemos!`;
};

export const createPortalShareMessage = ({ config, portalUrl }) => {
  const profesional = config?.nombre || 'Lic. Virna Toledo';
  const titulo = config?.titulo || 'Lic. en Psicología';
  const url = portalUrl || `${SITE_URL}/?portal=paciente`;

  return `¡Hola! Te comparto el enlace de reservas online de ${profesional} (${titulo}) para que puedas elegir el día y horario que mejor te quede para tu turno:\n\n👉 ${url}\n\n¡Cualquier consulta estoy a tu disposición!`;
};


