import { BrandMark } from '../Common/BrandMark';
import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Building2, 
  User, 
  Phone, 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Share2, 
  Copy, 
  MessageCircle, 
  CalendarDays,
  ExternalLink,
  Award,
  ArrowRight,
  AlertCircle,
  XCircle,
  Check
} from 'lucide-react';
import { generateWhatsappLink, formatArgentinaPhoneForWhatsapp } from '../../services/whatsapp';
import { generarSlots, proximasFechas, horarioDeSede, describirHorario, atiendeEseDia, finDeTurno } from '../../lib/agendaPortal';
import { portalUrl } from '../../services/portalCloud';
import { parseISODate } from '../../lib/dates';

const etiquetaFecha = (iso) =>
  parseISODate(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

export const PortalTurnosView = ({
  sedes = [],
  obrasSociales = [],
  turnos = [],
  config = {},
  onSaveTurno,
  onActualizarTurnoEstado,
  onDeleteTurno,
  onBackToApp,
  portalId = null,
  onConnectAccount = null,
  isStandalone = false
}) => {
  const [step, setStep] = useState(1);
  const [copiedLink, setCopiedLink] = useState(false);

  // Booking Form State
  const [selectedSedeId, setSelectedSedeId] = useState(sedes[0]?.id || '');
  const [selectedFecha, setSelectedFecha] = useState(() => proximasFechas(sedes[0], 1)[0] || '');
  const [selectedHora, setSelectedHora] = useState('');
  
  // Patient details
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [obraSocial, setObraSocial] = useState('particular');
  const [numeroAfiliado, setNumeroAfiliado] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');

  // Confirmation result
  const [confirmedTurno, setConfirmedTurno] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  const solicitudesWebPendientes = turnos.filter(t => t.estado === 'Solicitado (Web)');
  const selectedSede = sedes.find(s => s.id === selectedSedeId) || sedes[0];

  const getSedeIcon = (id) => {
    if (id === 'sede-centro') return <Building2 size={20} className="text-indigo-600 dark:text-indigo-400" />;
    if (id === 'sede-sanmartin') return <MapPin size={20} className="text-rose-600 dark:text-rose-400" />;
    return <Video size={20} className="text-sky-600 dark:text-sky-400" />;
  };

  const duracion = config.duracionTurnoMinutos || 45;
  const horarioSede = selectedSede ? horarioDeSede(selectedSede) : null;
  const fechasSugeridas = selectedSede ? proximasFechas(selectedSede, 6) : [];
  const slots = generarSlots({ sede: selectedSede, fecha: selectedFecha, duracion, turnos });
  const slotsLibres = slots.filter(s => !s.ocupado);

  const elegirSede = (id) => {
    setSelectedSedeId(id);
    const sede = sedes.find(s => s.id === id);
    setSelectedFecha(proximasFechas(sede, 1)[0] || '');
    setSelectedHora('');
  };

  // Sin la cuenta conectada el link no puede mostrar los datos reales: primero se conecta.
  const necesitaConectar = !portalId && Boolean(onConnectAccount);

  const handleCopyLink = () => {
    if (necesitaConectar) { onConnectAccount(); return; }
    const url = portalUrl(portalId);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsapp = () => {
    if (necesitaConectar) { onConnectAccount(); return; }
    const url = portalUrl(portalId);
    const msg = `¡Hola! Te comparto el enlace para solicitar tu turno de psicología online con ${config.nombre || 'la Lic. Virna Toledo'}: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const calculateEndTime = (startTime) => (startTime ? finDeTurno(startTime, duracion) : '');

  const handleCompleteBooking = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (!selectedHora) {
      alert('Por favor seleccioná un horario disponible.');
      return;
    }

    const osObj = obrasSociales.find(o => o.id === obraSocial);
    const coseguro = osObj ? (osObj.coseguroRecomendado || 0) : (obraSocial === 'particular' ? 25000 : 0);

    const newTurno = {
      id: `turno-web-${Date.now()}`,
      pacienteId: `pac-web-${Date.now()}`,
      pacienteNombre: nombre,
      pacienteTelefono: telefono,
      pacienteDni: dni,
      pacienteEmail: email,
      pacienteObraSocial: osObj ? osObj.nombre : obraSocial,
      numeroAfiliado: numeroAfiliado,
      fecha: selectedFecha,
      horaInicio: selectedHora,
      horaFin: calculateEndTime(selectedHora),
      sedeId: selectedSedeId,
      modalidad: selectedSedeId === 'sede-online' || selectedSede?.icono === 'Video' ? 'Online' : 'Presencial',
      estado: 'Solicitado (Web)',
      coseguroMonto: coseguro,
      coseguroEstado: 'Pendiente',
      medioPago: 'A convenir',
      notas: `Solicitud Online • DNI: ${dni} • ${motivoConsulta ? `Motivo: ${motivoConsulta}` : ''}`
    };

    setErrorEnvio('');
    setEnviando(true);
    try {
      if (onSaveTurno) await onSaveTurno(newTurno);
    } catch (err) {
      console.error('No se pudo enviar la solicitud:', err);
      setErrorEnvio('No pudimos enviar tu solicitud. Revisá tu conexión e intentá de nuevo.');
      setEnviando(false);
      return;
    }
    setEnviando(false);

    setConfirmedTurno(newTurno);
    setStep(4);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in pb-12">
      
      {/* Admin Share & Solicitudes Banner */}
      {!isStandalone && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-300" /> Portal Pacientes & Turnero Web
                </span>
              </div>
              <h3 className="text-lg font-semibold font-display">Portal de Autogestión para Pacientes</h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                Tus pacientes pueden ingresar desde su celular, elegir fecha y hora disponible, y solicitar turno directamente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="btn btn-secondary text-xs"
              >
                {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Link'}</span>
              </button>

              <button
                onClick={handleShareWhatsapp}
                className="btn btn-whatsapp text-xs"
              >
                <MessageCircle size={14} />
                <span>Compartir WhatsApp</span>
              </button>
            </div>
          </div>

          {!portalId && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900 text-[13px]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">
                Para que el link muestre tus sedes y horarios en el celular de tus pacientes, conectá tu cuenta.
                Hasta entonces el link no tiene tus datos.
              </span>
              {onConnectAccount && (
                <button type="button" onClick={onConnectAccount} className="btn btn-primary text-xs shrink-0">
                  Conectar mi cuenta
                </button>
              )}
            </div>
          )}

          {/* Solicitudes Web Recibidas */}
          {solicitudesWebPendientes.length > 0 && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Solicitudes Web Pendientes</span>
                    <span className="bg-emerald-600 text-white text-[11px] font-semibold px-1.5 py-0.2 rounded-full">
                      {solicitudesWebPendientes.length}
                    </span>
                  </h4>
                </div>
                <span className="text-[12px] text-slate-500">Revisá y confirmá los turnos pedidos online</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {solicitudesWebPendientes.map((turno) => {
                  const pacNombre = turno.pacienteNombre || 'Paciente';
                  const pacTel = turno.pacienteTelefono || '';
                  const pacOs = turno.pacienteObraSocial || 'Particular';
                  const waConfirmLink = pacTel ? generateWhatsappLink(
                    pacTel,
                    `¡Hola ${pacNombre}! Te confirmo tu turno de atención psicológica con ${config.nombre || 'la Lic. Virna Toledo'} para el día ${turno.fecha} a las ${turno.horaInicio} hs. ¡Nos vemos!`
                  ) : '#';

                  return (
                    <div key={turno.id} className="card p-3 flex flex-col justify-between gap-2.5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-semibold text-xs text-slate-900 dark:text-white">{pacNombre}</h5>
                          <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            {turno.fecha} • {turno.horaInicio} hs
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                          <strong>Tel:</strong> {pacTel || '-'} • <strong>Cobertura:</strong> {pacOs}
                        </p>
                        {turno.notas && (
                          <p className="text-[12px] text-slate-600 dark:text-slate-400 italic mt-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg">
                            {turno.notas}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        {onActualizarTurnoEstado && (
                          <button
                            onClick={() => {
                              onActualizarTurnoEstado(turno.id, 'Confirmado');
                              alert(`¡Turno de ${pacNombre} confirmado!`);
                            }}
                            className="flex-1 btn btn-primary text-xs py-1"
                          >
                            <CheckCircle2 size={12} />
                            <span>Aprobar Turno</span>
                          </button>
                        )}

                        {pacTel && (
                          <a
                            href={waConfirmLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-whatsapp text-xs py-1 px-2.5"
                            title="Confirmar por WhatsApp"
                          >
                            <MessageCircle size={12} />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        {onDeleteTurno && (
                          <button
                            onClick={() => {
                              if (confirm(`¿Rechazar y eliminar la solicitud de ${pacNombre}?`)) {
                                onDeleteTurno(turno.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Rechazar solicitud"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Booking Container */}
      <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden shadow-[var(--shadow-pop)] border border-[var(--border-color)] max-w-2xl mx-auto">
        
        {/* Portal Header */}
        <div className="bg-emerald-900 text-white p-7 sm:p-9 text-center relative overflow-hidden">
          <div className="relative z-10 max-w-md mx-auto">
            <div className="flex justify-center mb-4"><BrandMark size={44} tone="light" /></div>
            <h1 className="font-serif text-[2.1rem] md:text-[2.5rem] leading-tight text-white">
              {config.nombre || 'Lic. Profesional'}
            </h1>

            <p className="text-emerald-200 text-[13px] font-medium mt-1">
              {config.titulo || 'Licenciada en Psicología'} • {config.matriculaProvincial || 'M.P. 1842'}
            </p>
            <p className="text-emerald-100/80 text-[14px] mt-3 max-w-sm mx-auto leading-relaxed">
              {config.portalMensajeBienvenida || 'Solicitá tu turno en simples pasos. Seleccioná modalidad, fecha y completá tus datos.'}
            </p>
          </div>

          {/* Stepper Progress */}
          {step < 4 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-5 border-t border-white/10 max-w-xs mx-auto">
              {[1, 2, 3].map((num) => (
                <div key={num} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    step === num 
                      ? 'bg-[#f4f1e8] text-emerald-900' 
                      : step > num 
                      ? 'bg-emerald-400 text-emerald-950' 
                      : 'border border-white/25 text-emerald-100/70'
                  }`}>
                    {step > num ? '✓' : num}
                  </div>
                  {num < 3 && <div className={`w-8 h-0.5 rounded-full ${step > num ? 'bg-emerald-300' : 'bg-white/20'}`} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form Body Steps */}
        <div className="p-6 sm:p-8">
          
          {/* STEP 1: Modalidad y Sede */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center max-w-md mx-auto mb-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Paso 1: Elegí la Modalidad de Atención</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Podés atenderte presencialmente en Corrientes o de forma 100% online.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sedes.map((sede) => {
                  const isSelected = selectedSedeId === sede.id;
                  return (
                    <div
                      key={sede.id}
                      onClick={() => elegirSede(sede.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between relative ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20' 
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10.5px] font-semibold">
                          ✓
                        </div>
                      )}
                      <div>
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit mb-2.5">
                          {getSedeIcon(sede.id)}
                        </div>
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-white">{sede.nombre}</h4>
                        <p className="text-[12px] text-slate-500 mt-0.5">{sede.direccion}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {describirHorario(horarioDeSede(sede))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!selectedSede}
                  className="btn btn-primary text-xs py-2 px-5 font-semibold"
                >
                  <span>Continuar a Selección de Horario</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Fecha y Horario */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center max-w-md mx-auto mb-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Paso 2: Seleccioná Día y Horario</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sede seleccionada: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedSede?.nombre}</span>
                </p>
                {horarioSede && (
                  <p className="text-[12px] text-slate-500 mt-0.5">Atiende: {describirHorario(horarioSede)}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Date Picker Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar size={13} /> Elegir Fecha
                  </label>
                  <input
                    type="date"
                    value={selectedFecha}
                    min={proximasFechas(selectedSede, 1, new Date(Date.now() - 86400000))[0] || ''}
                    onChange={(e) => {
                      setSelectedFecha(e.target.value);
                      setSelectedHora('');
                    }}
                    className="input-field text-xs font-semibold"
                  />
                  {fechasSugeridas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {fechasSugeridas.map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => { setSelectedFecha(f); setSelectedHora(''); }}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-colors capitalize ${
                            selectedFecha === f
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {etiquetaFecha(f)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Slots Grid */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock size={13} /> Horarios Disponibles {selectedFecha && <span className="capitalize">({etiquetaFecha(selectedFecha)})</span>}
                  </label>

                  {selectedFecha && !atiendeEseDia(selectedSede, selectedFecha) && (
                    <p className="text-[12.5px] text-slate-500">Ese día no hay atención en esta sede. Elegí uno de los días sugeridos.</p>
                  )}
                  {selectedFecha && atiendeEseDia(selectedSede, selectedFecha) && slotsLibres.length === 0 && (
                    <p className="text-[12.5px] text-slate-500">No quedan horarios libres ese día. Probá con otra fecha.</p>
                  )}

                  <div className="grid grid-cols-3 gap-1.5">
                    {slots.map(({ hora: slot, ocupado: occupied }) => {
                      const isSelected = selectedHora === slot;

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={occupied}
                          onClick={() => setSelectedHora(slot)}
                          className={`py-1.5 px-1 rounded-xl text-xs font-medium transition-all ${
                            occupied
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {slot} hs
                        </button>
                      );
                    })}
                  </div>

                  {selectedHora && (
                    <div className="text-center pt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 py-1 rounded-lg">
                      Turno seleccionado: {selectedFecha} a las {selectedHora} hs
                    </div>
                  )}
                </div>

              </div>

              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary text-xs"
                >
                  <ChevronLeft size={14} />
                  <span>Volver</span>
                </button>

                <button
                  type="button"
                  disabled={!selectedHora}
                  onClick={() => setStep(3)}
                  className={`btn ${selectedHora ? 'btn-primary' : 'bg-slate-200 text-slate-400 cursor-not-allowed'} text-xs font-semibold`}
                >
                  <span>Continuar a Mis Datos</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Formulario de Paciente */}
          {step === 3 && (
            <form onSubmit={handleCompleteBooking} className="space-y-4 text-xs">
              <div className="text-center max-w-md mx-auto mb-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Paso 3: Tus Datos de Contacto</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Completá tus datos para que podamos registrar tu turno y contactarte.
                </p>
              </div>

              {/* Summary pill */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-500">Modalidad: </span>
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200">{selectedSede.nombre}</span>
                </div>
                <div>
                  <span className="text-slate-500">Horario: </span>
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200">{selectedFecha} a las {selectedHora} hs</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej: 3794123456"
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    DNI / Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ej: 38452190"
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    Email (Opcional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan.perez@gmail.com"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    Obra Social / Cobertura
                  </label>
                  <select
                    value={obraSocial}
                    onChange={(e) => setObraSocial(e.target.value)}
                    className="input-field"
                  >
                    <option value="particular">Particular (Sin obra social)</option>
                    {obrasSociales.filter(o => o.id !== 'particular').map(os => (
                      <option key={os.id} value={os.id}>{os.nombre} ({os.sigla})</option>
                    ))}
                  </select>
                </div>

                {obraSocial !== 'particular' && (
                  <div>
                    <label className="block font-semibold mb-1">
                      Número de Afiliado
                    </label>
                    <input
                      type="text"
                      value={numeroAfiliado}
                      onChange={(e) => setNumeroAfiliado(e.target.value)}
                      placeholder="Ej: 01-994821-00"
                      className="input-field font-mono"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Motivo breve de consulta (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={motivoConsulta}
                  onChange={(e) => setMotivoConsulta(e.target.value)}
                  placeholder="Ej: Primera consulta por ansiedad, seguimiento terapéutico, etc."
                  className="input-field"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-secondary text-xs"
                >
                  <ChevronLeft size={14} />
                  <span>Volver</span>
                </button>

                <button
                  type="submit"
                  disabled={enviando}
                  className="btn btn-primary text-xs font-semibold"
                >
                  <CheckCircle2 size={14} />
                  <span>{enviando ? 'Enviando…' : 'Confirmar y Solicitar Turno'}</span>
                </button>
              </div>
              {errorEnvio && (
                <p className="text-[12.5px] text-rose-600 dark:text-rose-400 text-right">{errorEnvio}</p>
              )}
            </form>
          )}

          {/* STEP 4: Solicitud Confirmada con Éxito */}
          {step === 4 && confirmedTurno && (
            <div className="text-center py-4 space-y-4 max-w-md mx-auto">
              
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 size={28} />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white font-display">
                  ¡Turno Solicitado con Éxito!
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tu solicitud fue registrada en el sistema de la Lic. Virna Toledo.
                </p>
              </div>

              {/* Receipt Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Resumen de Turno</span>
                  <span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">
                    Pendiente de Aprobación
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Paciente</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{confirmedTurno.pacienteNombre}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">DNI</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{confirmedTurno.pacienteDni}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Fecha y Hora</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{confirmedTurno.fecha} - {confirmedTurno.horaInicio} hs</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Modalidad / Sede</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedSede.nombre}</span>
                  </div>
                </div>
              </div>

              {/* WhatsApp action */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    const profTel = config.telefono || '+5493794889922';
                    const msg = `¡Hola${config.nombre ? ` ${config.nombre}` : ''}! Acabo de solicitar un turno en tu portal web para el día ${confirmedTurno.fecha} a las ${confirmedTurno.horaInicio} hs en ${selectedSede.nombre}. Mi nombre es ${confirmedTurno.pacienteNombre}. ¡Muchas gracias!`;
                    const url = generateWhatsappLink(profTel, msg);
                    window.open(url, '_blank');
                  }}
                  className="w-full btn btn-whatsapp text-xs py-2.5 font-semibold"
                >
                  <MessageCircle size={15} />
                  <span>Avisar a la Psicóloga por WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setSelectedHora('');
                    setConfirmedTurno(null);
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold block mx-auto pt-1"
                >
                  Solicitar otro turno
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
