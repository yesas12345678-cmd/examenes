"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import ExamForm from "@/components/ExamForm";
import FishingForm from "@/components/FishingForm";
import CalendarViewer from "@/components/CalendarViewer";
import { ExamData, CalendarSlot, ApiResponse } from "@/types";
import { Gamepad2, Send, CheckCircle2, AlertTriangle, XCircle, LogIn, ShieldCheck, Fish, BookOpen } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();

  // Estado del Tab Activo
  const [activeTab, setActiveTab] = useState<"exam" | "fishing">("exam");

  // Estado del Formulario de Examen
  const [examData, setExamData] = useState<ExamData>({
    name: "",
    date: new Date().toISOString().split("T")[0],
    effortLevel: "1_day",
  });

  // Estado del Calendario y Selección
  const [events, setEvents] = useState<CalendarSlot[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<boolean>(false);

  // Estado de Sincronización
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Obtener eventos de Google Calendar
  const fetchEvents = async () => {
    if (!session || !session.accessToken) return;

    setIsLoadingCalendar(true);

    try {
      const res = await fetch("/api/calendar/events");
      const json: ApiResponse<CalendarSlot[]> = await res.json();

      if (json.success && json.data) {
        setEvents(json.data);
      } else {
        setSyncStatus({
          type: "error",
          message: json.error || "No se pudieron obtener los eventos de tu Google Calendar.",
        });
      }
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        message: "Error de red al intentar conectar con la API de Google Calendar.",
      });
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchEvents();
    }
  }, [status]);

  // Manejador del Botón Guardar y Sincronizar Examen
  const handleSaveAndSync = async () => {
    if (!session) {
      setSyncStatus({
        type: "error",
        message: "Por favor, inicia sesión con Google primero.",
      });
      return;
    }

    if (!examData.name.trim()) {
      setSyncStatus({
        type: "error",
        message: "El nombre del examen es un campo obligatorio.",
      });
      return;
    }

    const requiredSlotsMap = {
      "1_day": 2,
      "2_days": 4,
      "3_days": 6,
    };
    const requiredSlots = requiredSlotsMap[examData.effortLevel];

    if (selectedSlotIds.length !== requiredSlots) {
      setSyncStatus({
        type: "error",
        message: `Debes seleccionar exactamente ${requiredSlots} bloques de 1 hora (${requiredSlots / 2} sesiones de 2h). Actualmente tienes ${selectedSlotIds.length} seleccionados.`,
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam: examData,
          selectedSlotIds,
          allSlots: events,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSyncStatus({
          type: "success",
          message: json.message || "¡Bloques de estudio actualizados con éxito en tu Google Calendar!",
        });
        setSelectedSlotIds([]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        fetchEvents();
      } else {
        setSyncStatus({
          type: "error",
          message: json.error || json.message || "Ocurrió un error al actualizar los bloques de Google Calendar.",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        message: "Fallo de conexión en el servidor al procesar la actualización.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (status === "unauthenticated") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6 px-4">
        <div className="relative">
          <div className="absolute -inset-1 bg-yellow-400 rounded-3xl blur opacity-75 animate-pulse"></div>
          <div className="relative p-5 rounded-3xl bg-black text-yellow-400 border border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.4)] flex items-center justify-center">
            <Gamepad2 className="w-12 h-12" />
          </div>
        </div>

        <div className="space-y-2.5">
          <h2 className="text-3xl font-black text-yellow-400 tracking-wider uppercase drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
            StudySync ARCADE
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto font-medium">
            Conecta tu cuenta de Google Calendar para gestionar tus sesiones de estudio y jornadas de pesca en una interfaz Cyber-Arcade de alto rendimiento.
          </p>
        </div>

        <button
          onClick={() => signIn("google")}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.5)] transition-all duration-300 transform active:scale-95"
        >
          <LogIn className="w-5 h-5 stroke-[3]" />
          <span>Iniciar Sesión con Google</span>
        </button>

        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 justify-center font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-yellow-400" /> Autenticación segura vía Google OAuth 2.0
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 pb-28 min-h-[90vh]">
      {/* Arcade Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-arcade-glow"></div>

      <div className="relative z-10 space-y-6">
        {/* Banner de Mensajes / Estado */}
        {syncStatus && (
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.8)] ${
              syncStatus.type === "success"
                ? "bg-yellow-950/60 border-yellow-400 text-yellow-200 shadow-yellow-900/30"
                : syncStatus.type === "warning"
                ? "bg-amber-950/60 border-amber-500/60 text-amber-200 shadow-amber-900/30"
                : "bg-rose-950/60 border-rose-500/60 text-rose-200 shadow-rose-900/30"
            }`}
          >
            {syncStatus.type === "success" && <CheckCircle2 className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />}
            {syncStatus.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {syncStatus.type === "error" && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            <div className="text-xs font-bold leading-relaxed flex-1 tracking-wide">
              {syncStatus.message}
            </div>
          </div>
        )}

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Izquierda: Selector de Tabs + Formulario Activo */}
          <div className="lg:col-span-5 space-y-6">
            {/* Tab Switcher */}
            <div className="p-1.5 bg-black/80 rounded-2xl border border-zinc-800 grid grid-cols-2 gap-2 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab("exam")}
                className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                  activeTab === "exam"
                    ? "bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)]"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Exámenes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("fishing")}
                className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                  activeTab === "fishing"
                    ? "bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Fish className="w-4 h-4 text-rose-400" />
                <span>Jornada Pesca</span>
              </button>
            </div>

            {/* Formulario según Tab */}
            {activeTab === "exam" ? (
              <ExamForm examData={examData} onChange={setExamData} />
            ) : (
              <FishingForm
                onSuccess={(msg) => {
                  setSyncStatus({ type: "success", message: msg });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onError={(err) => {
                  setSyncStatus({ type: "error", message: err });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onRefreshCalendar={fetchEvents}
              />
            )}
          </div>

          {/* Derecha: Visor Calendario */}
          <div className="lg:col-span-7">
            <CalendarViewer
              events={events}
              effortLevel={examData.effortLevel}
              selectedSlotIds={selectedSlotIds}
              onSelectSlots={setSelectedSlotIds}
              isLoading={isLoadingCalendar}
              onRefresh={fetchEvents}
            />
          </div>
        </div>
      </div>

      {/* Barra Acción Flotante Inferior Arcade (Solo visible en Tab Examen) */}
      {activeTab === "exam" && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur-2xl border-t border-yellow-500/40 z-40 shadow-[0_-10px_30px_rgba(250,204,21,0.15)]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs text-zinc-400 hidden sm:flex items-center gap-2 font-bold uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping"></span>
              <span>Examen: <strong className="text-yellow-400 font-black">{examData.name || "Sin nombre"}</strong></span>
              <span className="text-zinc-700">|</span>
              <span>Bloques: <strong className="text-white font-black">{selectedSlotIds.length} seleccionados</strong></span>
            </div>

            <button
              onClick={handleSaveAndSync}
              disabled={isSyncing}
              className="w-full sm:w-auto px-9 py-4 animate-arcade-shimmer text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.6)] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 transform active:scale-95 ml-auto border border-yellow-400"
            >
              {isSyncing ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4.5 h-4.5 text-black stroke-[3]" />
                  <span>Guardar y Sincronizar Examen</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
