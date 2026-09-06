"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import ExamForm from "@/components/ExamForm";
import CalendarViewer from "@/components/CalendarViewer";
import { ExamData, CalendarSlot, ApiResponse } from "@/types";
import { Sparkles, Send, CheckCircle2, AlertTriangle, XCircle, LogIn } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();

  // Estado del Formulario
  const [examData, setExamData] = useState<ExamData>({
    name: "",
    date: new Date().toISOString().split("T")[0],
    priority: "High",
    type: "Exam",
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

  // Función para obtener eventos de Google Calendar
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
      <div className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
        <div className="p-4 rounded-3xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-2xl">
          <Sparkles className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-100">Bienvenido a StudySync</h2>
          <p className="text-sm text-slate-400">
            Conecta tu cuenta de Google para reservar tus sesiones de estudio directamente en tus bloques libres de Google Calendar.
          </p>
        </div>
        <button
          onClick={() => signIn("google")}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-xl shadow-indigo-500/25 transition-all duration-200"
        >
          <LogIn className="w-5 h-5" />
          <span>Iniciar Sesión con Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Banner de Mensajes / Estado */}
      {syncStatus && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all animate-fadeIn ${
            syncStatus.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-200"
              : syncStatus.type === "warning"
              ? "bg-amber-950/50 border-amber-500/50 text-amber-200"
              : "bg-rose-950/50 border-rose-500/50 text-rose-200"
          }`}
        >
          {syncStatus.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {syncStatus.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
          {syncStatus.type === "error" && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          <div className="text-sm leading-relaxed flex-1">
            {syncStatus.message}
          </div>
        </div>
      )}

      {/* Grid Principal Dividida (Izquierda: Formulario, Derecha: Calendario) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Izquierda / Arriba: Formulario */}
        <div className="lg:col-span-5 space-y-6">
          <ExamForm examData={examData} onChange={setExamData} />
        </div>

        {/* Derecha / Abajo: Visor de Calendario */}
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

      {/* Barra Inferior Fija para la Acción Mágica */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-slate-400 hidden sm:block">
            Examen: <strong className="text-slate-200">{examData.name || "Sin nombre"}</strong> | 
            Slots: <strong className="text-indigo-400">{selectedSlotIds.length} seleccionados</strong>
          </div>

          <button
            onClick={handleSaveAndSync}
            disabled={isSyncing}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl shadow-xl shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 transform active:scale-95 ml-auto"
          >
            {isSyncing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Sincronizando con Google Calendar...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Guardar y Sincronizar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
