import {
  INITIAL_SEDES,
  INITIAL_OBRAS_SOCIALES,
  INITIAL_PACIENTES,
  INITIAL_TURNOS,
  INITIAL_LIQUIDACIONES,
  INITIAL_FACTURAS,
  INITIAL_CONFIG_PROFESIONAL
} from '../data/initialData';

const STORAGE_KEYS = {
  SEDES: 'psicoplus_sedes_v1',
  OBRAS_SOCIALES: 'psicoplus_obras_sociales_v1',
  PACIENTES: 'psicoplus_pacientes_v1',
  TURNOS: 'psicoplus_turnos_v1',
  LIQUIDACIONES: 'psicoplus_liquidaciones_v1',
  FACTURAS: 'psicoplus_facturas_v1',
  CONFIG: 'psicoplus_config_v1',
  THEME: 'psicoplus_theme_v1',
};

export const getStoredData = () => {
  try {
    const sedes = JSON.parse(localStorage.getItem(STORAGE_KEYS.SEDES)) || INITIAL_SEDES;
    const obrasGuardadas = JSON.parse(localStorage.getItem(STORAGE_KEYS.OBRAS_SOCIALES));
    // Suma al catálogo guardado las obras sociales nuevas, sin tocar los aranceles ya cargados.
    const obrasSociales = obrasGuardadas
      ? [
          ...obrasGuardadas.filter(os => os.id !== 'particular'),
          ...INITIAL_OBRAS_SOCIALES.filter(os => os.id !== 'particular' && !obrasGuardadas.some(g => g.id === os.id)),
          ...(obrasGuardadas.filter(os => os.id === 'particular').length
            ? obrasGuardadas.filter(os => os.id === 'particular')
            : INITIAL_OBRAS_SOCIALES.filter(os => os.id === 'particular')),
        ]
      : INITIAL_OBRAS_SOCIALES;
    const pacientes = JSON.parse(localStorage.getItem(STORAGE_KEYS.PACIENTES)) || INITIAL_PACIENTES;
    const turnos = JSON.parse(localStorage.getItem(STORAGE_KEYS.TURNOS)) || INITIAL_TURNOS;
    const liquidaciones = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIQUIDACIONES)) || INITIAL_LIQUIDACIONES;
    const facturas = JSON.parse(localStorage.getItem(STORAGE_KEYS.FACTURAS)) || INITIAL_FACTURAS;
    let config = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG)) || INITIAL_CONFIG_PROFESIONAL;
    if (config.nombre === 'Lic. Florencia Romero') {
      config = { ...config, ...INITIAL_CONFIG_PROFESIONAL };
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    }
    const theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';

    return { sedes, obrasSociales, pacientes, turnos, liquidaciones, facturas, config, theme };
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
    return {
      sedes: INITIAL_SEDES,
      obrasSociales: INITIAL_OBRAS_SOCIALES,
      pacientes: INITIAL_PACIENTES,
      turnos: INITIAL_TURNOS,
      liquidaciones: INITIAL_LIQUIDACIONES,
      facturas: INITIAL_FACTURAS,
      config: INITIAL_CONFIG_PROFESIONAL,
      theme: 'light',
    };

  }
};

export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

export const exportFullBackup = () => {
  const fullData = getStoredData();
  const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `PsicoPlus_Backup_${dateStr}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const resetToDemoData = () => {
  localStorage.setItem(STORAGE_KEYS.SEDES, JSON.stringify(INITIAL_SEDES));
  localStorage.setItem(STORAGE_KEYS.OBRAS_SOCIALES, JSON.stringify(INITIAL_OBRAS_SOCIALES));
  localStorage.setItem(STORAGE_KEYS.PACIENTES, JSON.stringify(INITIAL_PACIENTES));
  localStorage.setItem(STORAGE_KEYS.TURNOS, JSON.stringify(INITIAL_TURNOS));
  localStorage.setItem(STORAGE_KEYS.LIQUIDACIONES, JSON.stringify(INITIAL_LIQUIDACIONES));
  localStorage.setItem(STORAGE_KEYS.FACTURAS, JSON.stringify(INITIAL_FACTURAS));
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(INITIAL_CONFIG_PROFESIONAL));
  window.location.reload();
};

