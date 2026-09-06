"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import ExamForm from "@/components/ExamForm";
import CalendarViewer from "@/components/CalendarViewer";
import { ExamData, CalendarSlot, ApiResponse } from "@/types";
import { Sparkles, Send, CheckCircle2, AlertTriangle, XCircle, LogIn, ShieldCheck } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();

  // Estado del Formulario
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
    setSyncStatus(null);

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

  // Manejador del Botón Guardar y Sincronizar
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
          message: json.message || "¡Bloques de estudio actualizados con éxito en Google Calendar!",
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
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur opacity-75 animate-pulse"></div>
          <div className="relative p-5 rounded-3xl bg-slate-950 text-indigo-400 border border-slate-800 shadow-2xl flex items-center justify-center">
            <Sparkles className="w-12 h-12" />
          </div>
        </div>

        <div className="space-y-2.5">
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Bienvenido a StudySync
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Conecta tu cuenta de Google Calendar para sincronizar tus bloques de estudio en tiempo real con notificaciones directas.
          </p>
        </div>

        <button
          onClick={() => signIn("google")}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold text-sm rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all duration-300 transform active:scale-95"
        >
          <LogIn className="w-5 h-5" />
          <span>Iniciar Sesión con Google</span>
        </button>

        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Integración oficial segura de Google OAuth 2.0
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 pb-28 min-h-[90vh]">
      {/* Background Radial Lights */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-cyber-glow"></div>

      <div className="relative z-10 space-y-6">
        {/* Banner de Mensajes / Estado */}
        {syncStatus && (
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.4)] ${
              syncStatus.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200 shadow-emerald-900/20"
                : syncStatus.type === "warning"
                ? "bg-amber-950/60 border-amber-500/50 text-amber-200 shadow-amber-900/20"
                : "bg-rose-950/60 border-rose-500/50 text-rose-200 shadow-rose-900/20"
            }`}
          >
            {syncStatus.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {syncStatus.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {syncStatus.type === "error" && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            <div className="text-xs font-semibold leading-relaxed flex-1">
              {syncStatus.message}
            </div>
          </div>
        )}

        {/* Grid Principal (Izquierda: Formulario, Derecha: Visor Calendario) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Izquierda: Formulario */}
          <div className="lg:col-span-5 space-y-6">
            <ExamForm examData={examData} onChange={setExamData} />
          </div>

          {/* Derecha: Visor de Calendario */}
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

      {/* Barra Acción Flotante Inferior de Cristal */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-800/90 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-slate-400 hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            <span>Examen: <strong className="text-slate-100 font-bold">{examData.name || "Sin nombre"}</strong></span>
            <span className="text-slate-600">|</span>
            <span>Bloques: <strong className="text-indigo-400 font-bold">{selectedSlotIds.length} seleccionados</strong></span>
          </div>

          <button
            onClick={handleSaveAndSync}
            disabled={isSyncing}
            className="w-full sm:w-auto px-8 py-3.5 animate-shimmer text-white font-extrabold text-sm rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 transform active:scale-95 ml-auto tracking-wide"
          >
            {isSyncing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Sincronizando con Google Calendar...</span>
              </>
            ) : (
              <>
                <Send className="w-4.5 h-4.5 text-white" />
                <span>Guardar y Sincronizar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

