import { hashPassword, verifyPassword } from './securityService';
import { openCloudSession, closeCloudSession } from './cloudSettings';

const STORAGE_KEYS = {
  CURRENT_USER: 'psicoplus_current_user_v1',
  REGISTERED_USERS: 'psicoplus_users_db_v1',
  IS_DEMO_MODE: 'psicoplus_demo_mode_v1',
};

export const DEMO_USER = {
  id: 'user-demo-virna',
  nombre: 'Lic. Virna Toledo',
  email: 'lic.virna.toledo@gmail.com',
  titulo: 'Licenciada en Psicología',
  matriculaProvincial: 'M.P. 1842',
  colegio: 'Colegio de Psicólogos de Corrientes',
  especialidad: 'Terapia Cognitivo Conductual (TCC) & Adultos',
  telefono: '+54 9 379 488-9922',
  isDemo: true,
};

// Cuenta completa de Virna: solo se guarda el hash SHA-256 (con sal) de su contraseña.
const VIRNA_PASSWORD_HASH = '74e87de78a2c0faaa284fdea34490bb8570be6fd6166993a879f8a559489b0f5';

export const VIRNA_FULL_USER = {
  ...DEMO_USER,
  id: 'user-virna-full',
  isDemo: false,
  fullAccess: true, // PRO ilimitado, sin vencimiento
};

export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error al leer usuario actual:', e);
  }
  return DEMO_USER;
};

export const setCurrentUser = (user) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } catch (e) {
    console.error('Error al guardar usuario actual:', e);
  }
};

export const getRegisteredUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

// Datos del perfil que se guardan junto con la cuenta en la nube (nunca la contraseña).
const perfilPublico = (u) => ({
  nombre: u.nombre,
  titulo: u.titulo,
  matriculaProvincial: u.matriculaProvincial,
  colegio: u.colegio,
  especialidad: u.especialidad,
  telefono: u.telefono,
  consultorioInicial: u.consultorioInicial,
});

const guardarUsuarios = (users) => {
  try {
    localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Error al guardar usuarios:', e);
  }
};

// Arma el usuario local a partir de una cuenta que existe en la nube (otro dispositivo).
const usuarioDesdeNube = async (cloudUser, password) => {
  const meta = cloudUser.user_metadata || {};
  return {
    id: `user-${cloudUser.id}`,
    cloudId: cloudUser.id,
    nombre: meta.nombre || cloudUser.email,
    email: (cloudUser.email || '').toLowerCase(),
    passwordHash: await hashPassword(password),
    titulo: meta.titulo || 'Licenciado/a en Psicología',
    matriculaProvincial: meta.matriculaProvincial || 'M.P. En trámite',
    colegio: meta.colegio || 'Colegio de Psicólogos',
    especialidad: meta.especialidad || 'Psicología Clínica',
    telefono: meta.telefono || '',
    consultorioInicial: meta.consultorioInicial,
    fechaRegistro: cloudUser.created_at || new Date().toISOString(),
    isDemo: false,
  };
};

const MSG_CONFIRMAR = 'Revisá tu correo y confirmá la cuenta para poder ingresar.';

export const registerUser = async ({
  nombre,
  email,
  password,
  matriculaProvincial,
  colegio,
  especialidad,
  telefono,
  nombreConsultorio,
  direccionConsultorio,
}) => {
  const users = getRegisteredUsers();
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
    return { success: false, error: 'Ya existe una cuenta registrada con este correo electrónico.' };
  }

  // Cifrado criptográfico de la contraseña antes de guardar en almacenamiento
  const passwordHash = await hashPassword(password);

  const newUser = {
    id: `user-${Date.now()}`,
    nombre: nombre.trim(),
    email: normalizedEmail,
    passwordHash, // Protegido con hash SHA-256
    titulo: 'Licenciado/a en Psicología',
    matriculaProvincial: matriculaProvincial?.trim() || 'M.P. En trámite',
    colegio: colegio?.trim() || 'Colegio de Psicólogos',
    especialidad: especialidad?.trim() || 'Psicología Clínica',
    telefono: telefono?.trim() || '',
    consultorioInicial: {
      nombre: nombreConsultorio?.trim() || 'Consultorio Principal',
      direccion: direccionConsultorio?.trim() || 'Atención Presencial / Virtual',
    },
    fechaRegistro: new Date().toISOString(),
    isDemo: false,
  };

  // La cuenta también se crea en la nube, para que la configuración siga al usuario.
  const cloud = await openCloudSession({ email: normalizedEmail, password, perfil: perfilPublico(newUser) });
  if (cloud.reason === 'wrong-password') {
    return { success: false, error: 'Ya existe una cuenta con este correo. Iniciá sesión.' };
  }
  if (cloud.user) newUser.cloudId = cloud.user.id;

  users.push(newUser);
  guardarUsuarios(users);
  setCurrentUser(newUser);

  return { success: true, user: newUser, cloud };
};

export const loginUser = async (email, password) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  
  // Cuenta de Virna: requiere su contraseña y habilita acceso total
  if (normalizedEmail === DEMO_USER.email.toLowerCase()) {
    const isMatch = await verifyPassword(password, VIRNA_PASSWORD_HASH);
    if (!isMatch) {
      return { success: false, error: 'Contraseña incorrecta.' };
    }
    const cloud = await openCloudSession({ email: normalizedEmail, password, perfil: perfilPublico(VIRNA_FULL_USER) });
    setCurrentUser(VIRNA_FULL_USER);
    return { success: true, user: VIRNA_FULL_USER, cloud };
  }

  const users = getRegisteredUsers();
  const found = users.find(u => u.email.toLowerCase() === normalizedEmail);

  // Cuenta creada en otro dispositivo: se busca en la nube.
  if (!found) {
    const cloud = await openCloudSession({ email: normalizedEmail, password, allowSignUp: false });
    if (cloud.ok) {
      const user = await usuarioDesdeNube(cloud.user, password);
      guardarUsuarios([...users, user]);
      setCurrentUser(user);
      return { success: true, user, cloud };
    }
    if (cloud.reason === 'confirm-email') return { success: false, error: MSG_CONFIRMAR };
    if (cloud.reason === 'wrong-password') return { success: false, error: 'Email o contraseña incorrectos.' };
    return { success: false, error: 'No se encontró ninguna cuenta con este correo.' };
  }

  // Verificación con hash o migración automática
  const storedHash = found.passwordHash || found.password;
  const isMatch = await verifyPassword(password, storedHash);

  if (!isMatch) {
    // Puede que la contraseña se haya cambiado desde otro dispositivo.
    const cloud = await openCloudSession({ email: normalizedEmail, password, allowSignUp: false });
    if (!cloud.ok) return { success: false, error: 'Contraseña incorrecta.' };
    found.passwordHash = await hashPassword(password);
    delete found.password;
    found.cloudId = cloud.user.id;
    guardarUsuarios(users);
    setCurrentUser(found);
    return { success: true, user: found, cloud };
  }

  // Si tenía contraseña vieja sin hash, migrarla a hash SHA-256
  if (!found.passwordHash) {
    found.passwordHash = await hashPassword(password);
    delete found.password;
  }

  // Cuentas que existían solo en este navegador se suben a la nube en este primer ingreso.
  const cloud = await openCloudSession({ email: normalizedEmail, password, perfil: perfilPublico(found) });
  if (cloud.user) found.cloudId = cloud.user.id;
  guardarUsuarios(users);

  setCurrentUser(found);
  return { success: true, user: found, cloud };
};

export const logoutUser = () => {
  setCurrentUser(DEMO_USER);
  closeCloudSession();
};
