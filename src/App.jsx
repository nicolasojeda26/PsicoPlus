import React, { useState, useEffect } from 'react';
import { HeartPulse } from 'lucide-react';
import { getStoredData, saveToStorage } from './services/storage';
import { getSubscriptionData, saveSubscriptionData, getEffectiveSubscription, PLANS } from './services/subscription';
import { getCurrentUser, setCurrentUser, DEMO_USER } from './services/auth';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/Dashboard/DashboardView';
import { AgendaView } from './components/Agenda/AgendaView';
import { PacientesView } from './components/Pacientes/PacientesView';
import { FacturasView } from './components/Facturas/FacturasView';
import { LiquidacionesView } from './components/Liquidaciones/LiquidacionesView';
import { FinanzasView } from './components/Finanzas/FinanzasView';
import { PortalTurnosView } from './components/PortalPacientes/PortalTurnosView';
import { ConfiguracionView } from './components/Configuracion/ConfiguracionView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ToastProvider, useToast } from './components/Common/Toast';
import { CommandPalette } from './components/Common/CommandPalette';
import { UpgradeModal } from './components/Common/UpgradeModal';
import { AuthModal } from './components/Auth/AuthModal';
import { LandingPage } from './components/Landing/LandingPage';
import { LegalModal } from './components/Legal/LegalModal';
import { BrandMark, BrandWordmark } from './components/Common/BrandMark';
import { CookieConsentBanner } from './components/Common/CookieConsentBanner';
import { supabase } from './lib/supabase';
import './App.css';

export function AppContent() {
  const initial = getStoredData();

  // Detect URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const isDirectPortal = urlParams.get('portal') === 'paciente' || urlParams.get('portal') === 'turnos' || urlParams.get('reserva') === 'true';
  const isDirectLanding = urlParams.get('landing') === 'true';
  const isDirectApp = urlParams.get('app') === 'true' || urlParams.get('demo') === 'true';

  // Visitantes nuevos (sin sesión guardada) ven primero la landing pública.
  let hasStoredSession = false;
  try {
    hasStoredSession = !!localStorage.getItem('psicoplus_current_user_v1');
  } catch {
    hasStoredSession = false;
  }

  // Navigation & View Mode
  const [viewMode, setViewMode] = useState(
    isDirectPortal
      ? 'portal-standalone'
      : isDirectLanding
      ? 'landing'
      : isDirectApp || hasStoredSession
      ? 'app'
      : 'landing'
  );
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSedeId, setSelectedSedeId] = useState('all');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(initial.theme === 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // User & Subscription state
  const [currentUser, setCurUser] = useState(getCurrentUser());
  const [storedSubscription, setSubscription] = useState(getSubscriptionData());
  const subscription = getEffectiveSubscription(currentUser, storedSubscription);

  // Modals state
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('register');
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState('terminos');

  const handleOpenLegal = (tab = 'terminos') => {
    setLegalModalTab(tab);
    setIsLegalModalOpen(true);
  };

  // Business Data state
  const [sedes, setSedes] = useState(initial.sedes);
  const [obrasSociales, setObrasSociales] = useState(initial.obrasSociales);
  const [pacientes, setPacientes] = useState(initial.pacientes);
  const [turnos, setTurnos] = useState(initial.turnos);
  const [liquidaciones, setLiquidaciones] = useState(initial.liquidaciones);
  const [facturas, setFacturas] = useState(initial.facturas || []);
  const [config, setConfig] = useState(initial.config);

  // Detail / Form Modals state
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [isTurnoModalOpen, setIsTurnoModalOpen] = useState(false);
  const [isPacienteModalOpen, setIsPacienteModalOpen] = useState(false);
  const [facturaPreselectedPaciente, setFacturaPreselectedPaciente] = useState(null);

  // Sync dark mode class with HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      saveToStorage('psicoplus_theme_v1', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      saveToStorage('psicoplus_theme_v1', 'light');
    }
  }, [isDarkMode]);

  // Global Keyboard Shortcuts (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenUpgrade = (reason = '') => {
    setUpgradeReason(reason);
    setIsUpgradeModalOpen(true);
  };

  const handlePlanUpdated = (newSub) => {
    setSubscription(newSub);
    saveSubscriptionData(newSub);
  };

  const handleAuthSuccess = (user, isNewRegistration = false) => {
    setCurUser(user);
    setCurrentUser(user);

    if (isNewRegistration) {
      // Configure initial profile for the new psychologist
      const newConfig = {
        ...config,
        nombre: user.nombre,
        matriculaProvincial: user.matriculaProvincial || 'M.P. En trámite',
        colegio: user.colegio || 'Colegio de Psicólogos',
        telefono: user.telefono || config.telefono,
        email: user.email,
      };
      setConfig(newConfig);
      saveToStorage('psicoplus_config_v1', newConfig);

      // Sede inicial del usuario
      if (user.consultorioInicial?.nombre) {
        const newSedes = [
          {
            id: `sede-${Date.now()}`,
            nombre: user.consultorioInicial.nombre,
            direccion: user.consultorioInicial.direccion,
            diasAtencion: 'Lunes a Viernes',
            color: '#0d9488',
            badgeClass: 'badge-sede-centro',
            icono: 'Building2',
          }
        ];
        setSedes(newSedes);
        saveToStorage('psicoplus_sedes_v1', newSedes);
      }
    }

    setViewMode('app');
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    if (confirm('¿Deseas cerrar la sesión actual y volver a la página principal?')) {
      setCurrentUser(DEMO_USER);
      setCurUser(DEMO_USER);
      setViewMode('landing');
    }
  };

  // Persist state updates to localStorage
  const handleSaveObrasSociales = (nuevas) => {
    setObrasSociales(nuevas);
    saveToStorage('psicoplus_obras_sociales_v1', nuevas);
  };

  const handleSaveSedes = (newSedes) => {
    setSedes(newSedes);
    saveToStorage('psicoplus_sedes_v1', newSedes);
  };

  const handleSaveConfig = (newConfig) => {
    setConfig(newConfig);
    saveToStorage('psicoplus_config_v1', newConfig);
  };

  const handleSavePaciente = (pacienteData) => {
    let updated;
    const exists = pacientes.some(p => p.id === pacienteData.id);
    if (exists) {
      updated = pacientes.map(p => p.id === pacienteData.id ? pacienteData : p);
    } else {
      updated = [pacienteData, ...pacientes];
    }
    setPacientes(updated);
    saveToStorage('psicoplus_pacientes_v1', updated);
    if (selectedPaciente?.id === pacienteData.id) {
      setSelectedPaciente(pacienteData);
    }
  };

  const handleDeletePaciente = (pacienteId) => {
    const updated = pacientes.filter(p => p.id !== pacienteId);
    setPacientes(updated);
    saveToStorage('psicoplus_pacientes_v1', updated);
    if (selectedPaciente?.id === pacienteId) setSelectedPaciente(null);
  };

  const handleSaveTurno = (turnoData) => {
    let updated;
    const exists = turnos.some(t => t.id === turnoData.id);
    if (exists) {
      updated = turnos.map(t => t.id === turnoData.id ? turnoData : t);
    } else {
      updated = [turnoData, ...turnos];
    }
    setTurnos(updated);
    saveToStorage('psicoplus_turnos_v1', updated);
  };

  const handleDeleteTurno = (turnoId) => {
    const updated = turnos.filter(t => t.id !== turnoId);
    setTurnos(updated);
    saveToStorage('psicoplus_turnos_v1', updated);
  };

  const handleActualizarTurnoEstado = (turnoId, nuevoEstado) => {
    const updated = turnos.map(t => {
      if (t.id === turnoId) {
        return {
          ...t,
          estado: nuevoEstado,
          coseguroEstado: nuevoEstado === 'Atendido' ? 'Cobrado' : t.coseguroEstado
        };
      }
      return t;
    });
    setTurnos(updated);
    saveToStorage('psicoplus_turnos_v1', updated);
  };

  const handleSaveEvolucion = (pacienteId, nuevaEvolucion) => {
    const updated = pacientes.map(p => {
      if (p.id === pacienteId) {
        const evos = [nuevaEvolucion, ...(p.evoluciones || [])];
        const nuevasConsumidas = (p.sesionesConsumidas || 0) + 1;
        return {
          ...p,
          evoluciones: evos,
          sesionesConsumidas: nuevasConsumidas,
        };
      }
      return p;
    });

    setPacientes(updated);
    saveToStorage('psicoplus_pacientes_v1', updated);
    
    const currentPac = updated.find(p => p.id === pacienteId);
    if (currentPac) setSelectedPaciente(currentPac);
  };

  // Facturas handlers
  const handleSaveFactura = (facturaData) => {
    let updated;
    const exists = facturas.some(f => f.id === facturaData.id);
    if (exists) {
      updated = facturas.map(f => f.id === facturaData.id ? facturaData : f);
    } else {
      updated = [facturaData, ...facturas];
    }
    setFacturas(updated);
    saveToStorage('psicoplus_facturas_v1', updated);
  };

  const handleDeleteFactura = (facturaId) => {
    const updated = facturas.filter(f => f.id !== facturaId);
    setFacturas(updated);
    saveToStorage('psicoplus_facturas_v1', updated);
  };

  const handleUpdateFacturaEstado = (facturaId, nuevoEstado) => {
    const updated = facturas.map(f => f.id === facturaId ? { ...f, estado: nuevoEstado } : f);
    setFacturas(updated);
    saveToStorage('psicoplus_facturas_v1', updated);
  };

  const handleSaveLiquidacion = (nuevaLiq) => {
    // Actualización funcional: la liquidación masiva guarda varias seguidas sin pisarse.
    setLiquidaciones(prev => {
      const updated = [nuevaLiq, ...prev];
      saveToStorage('psicoplus_liquidaciones_v1', updated);
      return updated;
    });
  };

  const handleUpdateLiquidacionEstado = (liqId, nuevoEstado) => {
    const updated = liquidaciones.map(l => l.id === liqId ? { ...l, estado: nuevoEstado } : l);
    setLiquidaciones(updated);
    saveToStorage('psicoplus_liquidaciones_v1', updated);
  };

  const handleDeleteLiquidacion = (liqId) => {
    const updated = liquidaciones.filter(l => l.id !== liqId);
    setLiquidaciones(updated);
    saveToStorage('psicoplus_liquidaciones_v1', updated);
  };

  // Counters
  const pacientesEnAlertaCount = pacientes.filter(p => {
    if (p.obraSocialId === 'particular') return false;
    const restantes = (p.sesionesAutorizadas || 10) - (p.sesionesConsumidas || 0);
    return restantes <= 2;
  }).length;

  const turnosWebPendientesCount = turnos.filter(t => t.estado === 'Solicitado (Web)').length;

  // Render 1: Standalone Patient Portal Mode
  if (viewMode === 'portal-standalone') {
    return (
      <div className="min-h-screen bg-transparent text-[var(--text-main)] p-3 sm:p-6 md:p-8 flex flex-col justify-between">
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between mb-4">
          <span className="flex items-center gap-2"><BrandMark size={28} /><BrandWordmark className="text-[var(--text-main)]" /><span className="text-[12.5px] text-slate-500 ml-1 hidden sm:inline">Portal de pacientes</span></span>
          <button
            onClick={() => {
              window.history.pushState({}, '', window.location.pathname);
              setViewMode('app');
              setActiveTab('dashboard');
            }}
            className="h-9 px-3 rounded-lg text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-900/5 font-medium"
          >
            Acceso profesional →
          </button>
        </div>
        <PortalTurnosView
          sedes={sedes}
          obrasSociales={obrasSociales}
          turnos={turnos}
          config={config}
          onSaveTurno={handleSaveTurno}
          isStandalone={true}
        />
        <footer className="text-center text-[12px] text-slate-400 mt-8 pb-6">
          © {new Date().getFullYear()} PsicoPlus - Sistema de Gestión Profesional
        </footer>
      </div>
    );
  }

  // Render 2: Landing Page View
  if (viewMode === 'landing') {
    return (
      <>
        <LandingPage
          onStartFree={() => {
            setAuthModalMode('register');
            setIsAuthModalOpen(true);
          }}
          onLogin={() => {
            setAuthModalMode('login');
            setIsAuthModalOpen(true);
          }}
          onOpenDemo={() => {
            setCurUser(DEMO_USER);
            setViewMode('app');
            setActiveTab('dashboard');
          }}
          onGoToPortal={() => setViewMode('portal-standalone')}
          onOpenLegal={handleOpenLegal}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          key={`${authModalMode}-${isAuthModalOpen}`}
          initialMode={authModalMode}
          onAuthSuccess={handleAuthSuccess}
        />

        <LegalModal
          isOpen={isLegalModalOpen}
          onClose={() => setIsLegalModalOpen(false)}
          initialTab={legalModalTab}
        />

        <CookieConsentBanner onOpenLegal={handleOpenLegal} />
      </>
    );
  }

  // Render 3: Main Professional App View
  return (
    <div className="min-h-screen flex bg-transparent text-[var(--text-main)] transition-colors">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        config={config}
        subscription={subscription}
        pacientesCount={pacientes.length}
        turnosWebPendientesCount={turnosWebPendientesCount}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenUpgradeModal={() => handleOpenUpgrade()}
        onOpenLanding={() => setViewMode('landing')}
        onLogout={handleLogout}
        onOpenLegal={handleOpenLegal}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        <Header 
          activeTab={activeTab}
          onNavigateTab={setActiveTab}
          sedes={sedes}
          selectedSedeId={selectedSedeId}
          onSelectSede={setSelectedSedeId}
          privacyMode={privacyMode}
          onTogglePrivacyMode={() => setPrivacyMode(!privacyMode)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          pacientesEnAlertaCount={pacientesEnAlertaCount}
          onNavigateAlerts={() => setActiveTab('pacientes')}
          turnosWebPendientesCount={turnosWebPendientesCount}
          onNavigatePortal={() => setActiveTab('portal-pacientes')}
          onNavigateAgenda={() => setActiveTab('agenda')}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          subscription={subscription}
          onOpenUpgradeModal={() => handleOpenUpgrade()}
          onSignOut={handleLogout}
        />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 pb-28 md:pb-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView 
              sedes={sedes}
              obrasSociales={obrasSociales}
              pacientes={pacientes}
              turnos={turnos}
              liquidaciones={liquidaciones}
              config={config}
              selectedSedeId={selectedSedeId}
              privacyMode={privacyMode}
              onNavigateTab={setActiveTab}
              onOpenNuevoTurno={() => {
                setActiveTab('agenda');
                setIsTurnoModalOpen(true);
              }}
              onOpenPacienteDetalle={(pac) => {
                setSelectedPaciente(pac);
                setActiveTab('pacientes');
              }}
              onActualizarTurnoEstado={handleActualizarTurnoEstado}
            />
          )}

          {activeTab === 'agenda' && (
            <AgendaView 
              sedes={sedes}
              obrasSociales={obrasSociales}
              pacientes={pacientes}
              turnos={turnos}
              config={config}
              selectedSedeId={selectedSedeId}
              privacyMode={privacyMode}
              onSaveTurno={handleSaveTurno}
              onDeleteTurno={handleDeleteTurno}
              onActualizarTurnoEstado={handleActualizarTurnoEstado}
              onOpenPacienteDetalle={(pac) => {
                setSelectedPaciente(pac);
                setActiveTab('pacientes');
              }}
              isModalOpen={isTurnoModalOpen}
              onCloseModal={() => setIsTurnoModalOpen(false)}
              onOpenNuevoTurno={() => setIsTurnoModalOpen(true)}
            />
          )}

          {activeTab === 'pacientes' && (
            <PacientesView 
              sedes={sedes}
              obrasSociales={obrasSociales}
              pacientes={pacientes}
              turnos={turnos}
              config={config}
              privacyMode={privacyMode}
              selectedPaciente={selectedPaciente}
              onSelectPaciente={setSelectedPaciente}
              onSavePaciente={handleSavePaciente}
              onDeletePaciente={handleDeletePaciente}
              onSaveEvolucion={handleSaveEvolucion}
              isCreateModalOpen={isPacienteModalOpen}
              onOpenCreateModal={() => setIsPacienteModalOpen(true)}
              onCloseCreateModal={() => setIsPacienteModalOpen(false)}
              onNavigateFacturar={(pac) => {
                setFacturaPreselectedPaciente(pac);
                setActiveTab('facturas');
              }}
              subscription={subscription}
              onOpenUpgradeModal={handleOpenUpgrade}
            />
          )}

          {activeTab === 'facturas' && (
            <FacturasView 
              facturas={facturas}
              pacientes={pacientes}
              config={config}
              onSaveFactura={handleSaveFactura}
              onDeleteFactura={handleDeleteFactura}
              onUpdateFacturaEstado={handleUpdateFacturaEstado}
              preselectedPaciente={facturaPreselectedPaciente}
              onClearPreselectedPaciente={() => setFacturaPreselectedPaciente(null)}
            />
          )}

          {activeTab === 'liquidaciones' && (
            <LiquidacionesView 
              obrasSociales={obrasSociales}
              pacientes={pacientes}
              turnos={turnos}
              liquidaciones={liquidaciones}
              config={config}
              onSaveObrasSociales={handleSaveObrasSociales}
              onSaveLiquidacion={handleSaveLiquidacion}
              onUpdateLiquidacionEstado={handleUpdateLiquidacionEstado}
              onDeleteLiquidacion={handleDeleteLiquidacion}
              subscription={subscription}
              onOpenUpgradeModal={handleOpenUpgrade}
            />
          )}

          {activeTab === 'finanzas' && (
            <FinanzasView 
              sedes={sedes}
              obrasSociales={obrasSociales}
              pacientes={pacientes}
              turnos={turnos}
              liquidaciones={liquidaciones}
              selectedSedeId={selectedSedeId}
              subscription={subscription}
              onOpenUpgradeModal={handleOpenUpgrade}
            />
          )}

          {activeTab === 'portal-pacientes' && (
            <PortalTurnosView
              sedes={sedes}
              obrasSociales={obrasSociales}
              turnos={turnos}
              config={config}
              onSaveTurno={handleSaveTurno}
              onActualizarTurnoEstado={handleActualizarTurnoEstado}
              onDeleteTurno={handleDeleteTurno}
              onBackToApp={() => setActiveTab('dashboard')}
              isStandalone={false}
            />
          )}

          {activeTab === 'configuracion' && (
            <ConfiguracionView 
              config={config}
              sedes={sedes}
              obrasSociales={obrasSociales}
              subscription={subscription}
              onSaveConfig={handleSaveConfig}
              onSaveSedes={handleSaveSedes}
              onOpenUpgradeModal={handleOpenUpgrade}
              onSubscriptionUpdated={handlePlanUpdated}
              onOpenLegal={handleOpenLegal}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav 
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          turnosWebPendientesCount={turnosWebPendientesCount}
        />

      </div>

      {/* Global Command Palette (Ctrl + K) */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        pacientes={pacientes}
        onSelectPaciente={(pac) => {
          setSelectedPaciente(pac);
          setActiveTab('pacientes');
        }}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenNuevoTurno={() => {
          setActiveTab('agenda');
          setIsTurnoModalOpen(true);
        }}
        onTogglePrivacyMode={() => setPrivacyMode(!privacyMode)}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      {/* Global Upgrade to PRO Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        featureReason={upgradeReason}
        onPlanUpdated={handlePlanUpdated}
      />

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        key={`${authModalMode}-${isAuthModalOpen}`}
          initialMode={authModalMode}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Global Legal & Privacy Modal (Ley 25.326 & ARCA) */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

      {/* Global Cookie Consent Banner */}
      <CookieConsentBanner onOpenLegal={handleOpenLegal} />

    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
