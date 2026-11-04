import { BrandMark } from '../Common/BrandMark';
import React, { useState } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Lock, 
  Award, 
  Building2, 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  PlayCircle
} from 'lucide-react';
import { registerUser, loginUser, DEMO_USER } from '../../services/auth';
import { useToast } from '../Common/Toast';

export const AuthModal = ({ 
  isOpen, 
  onClose, 
  initialMode = 'register', // 'register' | 'login'
  onAuthSuccess 
}) => {
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    matriculaProvincial: '',
    colegio: '',
    especialidad: 'Psicología Clínica (TCC / Sistémica / Psicoanálisis)',
    telefono: '',
    nombreConsultorio: '',
    direccionConsultorio: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!formData.nombre.trim() || !formData.email.trim() || !formData.password.trim()) {
          setError('Por favor completá los campos obligatorios (Nombre, Email y Contraseña).');
          setLoading(false);
          return;
        }

        const res = await registerUser(formData);
        setLoading(false);

        if (res.success) {
          toast.showSuccess(`¡Bienvenido/a a PsicoPlus, ${res.user.nombre}! Tu cuenta gratuita ha sido creada.`);
          if (onAuthSuccess) onAuthSuccess(res.user, true, res.cloud); // true = isNewRegistration
          onClose();
        } else {
          setError(res.error);
        }
      } else {
        // Login
        const res = await loginUser(formData.email, formData.password);
        setLoading(false);

        if (res.success) {
          toast.showSuccess(`Sesión iniciada correctamente. ¡Hola, ${res.user.nombre}!`);
          if (onAuthSuccess) onAuthSuccess(res.user, false, res.cloud);
          onClose();
        } else {
          setError(res.error);
        }
      }
    } catch (err) {
      console.error('Error en autenticación:', err);
      setError('Ocurrió un error inesperado al procesar la solicitud.');
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    if (onAuthSuccess) onAuthSuccess(DEMO_USER, false);
    toast.showInfo('Accediendo en Modo Demostración interactivo.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-[6px] animate-[backdropIn_.2s_ease-out]" 
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-[var(--bg-card)] text-[var(--text-main)] rounded-2xl border border-[var(--border-color)] shadow-[var(--shadow-pop)] overflow-hidden z-10 my-auto animate-[fadeIn_.28s_cubic-bezier(.23,1,.32,1)]">
        
        {/* Top pattern bar */}
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6 sm:p-8">
          
          {/* Logo & Header */}
          <div className="flex items-center gap-3 mb-5">
            <BrandMark size={40} />
            <div>
              <h3 className="font-serif text-[1.75rem] leading-tight text-slate-900 dark:text-white">
                {mode === 'register' ? 'Creá tu cuenta en PsicoPlus' : 'Iniciar Sesión'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-emerald-300/70">
                {mode === 'register' 
                  ? 'Plan Gratuito para psicólogos • Sin tarjeta de crédito' 
                  : 'Ingresá con tu correo profesional'}
              </p>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl mb-5 border border-slate-200 dark:border-emerald-900/50">
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-[13px] font-medium rounded-lg transition-all ${
                mode === 'register' 
                  ? 'bg-white dark:bg-emerald-700 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Registrarme Gratis
            </button>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-[13px] font-medium rounded-lg transition-all ${
                mode === 'login' 
                  ? 'bg-white dark:bg-emerald-700 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ya tengo cuenta
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            
            {mode === 'register' && (
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre Completo y Título *
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ej: Lic. Florencia Romero"
                    value={formData.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-emerald-900/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Correo Electrónico *
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="tu.email@psicologia.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-emerald-900/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Contraseña *
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-emerald-900/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Matrícula Provincial
                    </label>
                    <div className="relative">
                      <Award size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Ej: M.P. 2490"
                        value={formData.matriculaProvincial}
                        onChange={(e) => handleChange('matriculaProvincial', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-emerald-900/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      WhatsApp Consultorio
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="+54 9 11 ..."
                        value={formData.telefono}
                        onChange={(e) => handleChange('telefono', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-emerald-900/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Nombre o Sede de tu Consultorio
                  </label>
                  <div className="relative">
                    <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Ej: Consultorio Centro o Consultorio Virtual"
                      value={formData.nombreConsultorio}
                      onChange={(e) => handleChange('nombreConsultorio', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-emerald-900/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[14px] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Procesando...</span>
              ) : mode === 'register' ? (
                <>
                  <Sparkles size={14} />
                  <span>Crear mi Cuenta Gratuita</span>
                  <ArrowRight size={14} />
                </>
              ) : (
                <>
                  <span>Ingresar a mi Consultorio</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-emerald-950 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleDemoAccess}
              className="text-xs text-slate-500 dark:text-emerald-400/80 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold flex items-center gap-1.5"
            >
              <PlayCircle size={14} />
              <span>¿Querés probar primero? Entrar con datos de demostración</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
