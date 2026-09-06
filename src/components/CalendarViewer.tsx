"use client";

import { useState } from "react";
import { CalendarSlot, EffortLevel } from "@/types";
import { Calendar as CalendarIcon, CheckCircle2, Clock, RefreshCw, AlertCircle, Sparkles, Moon, Filter } from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";

interface CalendarViewerProps {
  events: CalendarSlot[];
  effortLevel: EffortLevel;
  selectedSlotIds: string[];
  onSelectSlots: (slotIds: string[]) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function CalendarViewer({
  events,
  effortLevel,
  selectedSlotIds,
  onSelectSlots,
  isLoading,
  onRefresh,
}: CalendarViewerProps) {
  // Filtro: 'all' | 'free' | 'night'
  const [activeFilter, setActiveFilter] = useState<"all" | "free" | "night">("free");

  // Determinar max bloques permitidos según nivel de esfuerzo
  const requiredSlotsMap: Record<EffortLevel, number> = {
    "1_day": 2,
    "2_days": 4,
    "3_days": 6,
  };
  const maxSlots = requiredSlotsMap[effortLevel];
  const maxSessions = maxSlots / 2;

  // Filtrar eventos según la pestaña seleccionada
  const displayedEvents = events.filter((e) => {
    if (activeFilter === "night") {
      return e.isDefaultNightSlot;
    }
    if (activeFilter === "free") {
      return e.isTimeBlock || e.isDefaultNightSlot;
    }
    return true;
  });

  // Agrupar eventos por día para renderizado ordenado
  const groupedEvents: Record<string, CalendarSlot[]> = {};
  displayedEvents.forEach((event) => {
    if (!event.start) return;
    const dateKey = format(parseISO(event.start), "yyyy-MM-dd");
    if (!groupedEvents[dateKey]) {
      groupedEvents[dateKey] = [];
    }
    groupedEvents[dateKey].push(event);
  });

  /**
   * Lógica para buscar el bloque consecutivo de 1 hora
   */
  const findConsecutiveSlot = (targetSlot: CalendarSlot): CalendarSlot | null => {
    const targetStart = parseISO(targetSlot.start);
    const targetEnd = parseISO(targetSlot.end);

    // Buscar bloque que empiece justo cuando termine targetSlot (siguiente hora)
    const nextSlot = events.find((e) => {
      if (e.id === targetSlot.id || (!e.isTimeBlock && !e.isDefaultNightSlot)) return false;
      const start = parseISO(e.start);
      return Math.abs(differenceInMinutes(start, targetEnd)) <= 5;
    });

    if (nextSlot) return nextSlot;

    // Si no hay siguiente, buscar bloque que termine justo cuando empiece targetSlot (hora anterior)
    const prevSlot = events.find((e) => {
      if (e.id === targetSlot.id || (!e.isTimeBlock && !e.isDefaultNightSlot)) return false;
      const end = parseISO(e.end);
      return Math.abs(differenceInMinutes(end, targetStart)) <= 5;
    });

    return prevSlot || null;
  };

  /**
   * Manejador al hacer clic en un bloque de 1 hora
   */
  const handleSlotClick = (slot: CalendarSlot) => {
    if (!slot.isTimeBlock && !slot.isDefaultNightSlot) return;

    const isAlreadySelected = selectedSlotIds.includes(slot.id);

    if (isAlreadySelected) {
      // Deseleccionar el bloque y su pareja consecutiva si existe
      const sibling = findConsecutiveSlot(slot);
      const idsToRemove = [slot.id, sibling?.id].filter(Boolean) as string[];
      onSelectSlots(selectedSlotIds.filter((id) => !idsToRemove.includes(id)));
      return;
    }

    // Buscar pareja consecutiva
    const sibling = findConsecutiveSlot(slot);

    if (!sibling) {
      alert("⚠️ Para cumplir la regla de 1 sesión (2 horas), debes seleccionar un bloque que tenga otra hora libre consecutiva inmediatamente antes o después.");
      return;
    }

    const pairIds = [slot.id, sibling.id];

    // Verificar si seleccionar esta pareja excede el máximo permitido
    let newSelected = [...selectedSlotIds];

    pairIds.forEach((id) => {
      if (!newSelected.includes(id)) {
        newSelected.push(id);
      }
    });

    // Si excede el máximo de bloques, descartar la pareja más antigua
    if (newSelected.length > maxSlots) {
      newSelected = newSelected.slice(newSelected.length - maxSlots);
    }

    onSelectSlots(newSelected);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-2xl border border-slate-800/90 hover:border-indigo-500/30 rounded-3xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-300 flex flex-col h-full min-h-[550px]">
      {/* Header del Visor */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight">Visor de Time Blocking</h2>
            <p className="text-xs text-slate-400">
              Google Calendar con bloques de noche garantizados (21:10-23:00 en L, M, X, J y D)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-slate-950/80 hover:bg-slate-800/80 text-slate-300 rounded-xl transition-all duration-200 border border-slate-800 hover:border-slate-700 disabled:opacity-50 active:scale-95 shadow-inner"
            title="Recargar eventos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Pestañas de Filtrado */}
      <div className="mt-4 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/90">
        <button
          onClick={() => setActiveFilter("free")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeFilter === "free"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Bloques Libres</span>
        </button>

        <button
          onClick={() => setActiveFilter("night")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeFilter === "night"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-purple-300" />
          <span>🌙 Bloques de Noche</span>
        </button>

        <button
          onClick={() => setActiveFilter("all")}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeFilter === "all"
              ? "bg-slate-800 text-slate-100 border border-slate-700"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Todos</span>
        </button>
      </div>

      {/* Banner de Estado de Selección */}
      <div className="mt-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950 border border-indigo-500/30 flex items-center justify-between flex-wrap gap-2 text-xs shadow-inner">
        <div className="flex items-center gap-2 text-indigo-200">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            Objetivo: <strong className="text-white font-bold">{maxSessions} sesión(es)</strong> = <strong className="text-white font-bold">{maxSlots} bloques (horas)</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-bold">
          <span className={selectedSlotIds.length === maxSlots ? "text-emerald-400" : "text-amber-400"}>
            Seleccionados: {selectedSlotIds.length} / {maxSlots} bloques ({selectedSlotIds.length / 2} de {maxSessions} sesiones)
          </span>
          {selectedSlotIds.length === maxSlots && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
          )}
        </div>
      </div>

      {/* Lista de Eventos y Bloques */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-5 max-h-[520px] custom-scrollbar">
        {isLoading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Cargando eventos de Google Calendar...</p>
          </div>
        ) : Object.keys(groupedEvents).length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-6">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No se encontraron eventos para el filtro seleccionado</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeFilter === "night"
                ? "Los bloques de noche fijos (21:10 - 23:00) están disponibles en Lunes, Martes, Miércoles, Jueves y Domingo."
                : "No hay bloques libres detectados en los próximos 14 días."}
            </p>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([dateStr, daySlots]) => {
            const dateObj = parseISO(dateStr);
            const formattedDate = format(dateObj, "EEEE d 'de' MMMM", { locale: es });

            return (
              <div key={dateStr} className="space-y-2.5">
                <div className="text-xs font-bold text-indigo-300 capitalize flex items-center justify-between tracking-wide">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                    {formattedDate}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {daySlots.map((slot) => {
                    const isSelected = selectedSlotIds.includes(slot.id);
                    const startTime = format(parseISO(slot.start), "HH:mm");
                    const endTime = format(parseISO(slot.end), "HH:mm");

                    return (
                      <button
                        key={slot.id}
                        onClick={() => handleSlotClick(slot)}
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between group active:scale-95 ${
                          isSelected
                            ? "bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-indigo-950/50 border-indigo-500 text-white shadow-[0_0_25px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/60"
                            : slot.isDefaultNightSlot
                            ? "bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-950 hover:from-purple-900/50 hover:to-indigo-900/40 border-purple-800/60 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                            : slot.isTimeBlock
                            ? "bg-slate-950/80 hover:bg-slate-900/90 border-slate-800/80 hover:border-indigo-500/40 text-slate-200"
                            : "bg-slate-950/30 border-slate-900 text-slate-500 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold">
                            <Clock className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-400" : slot.isDefaultNightSlot ? "text-purple-400" : "text-slate-400"}`} />
                            <span>{startTime} - {endTime}</span>
                            {slot.isDefaultNightSlot && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-extrabold border border-purple-500/40 flex items-center gap-1 shadow-[0_0_8px_rgba(168,85,247,0.2)]">
                                <Moon className="w-2.5 h-2.5 text-purple-300" /> Noche Fija
                              </span>
                            )}
                          </div>
                          <p className={`text-xs ${isSelected ? "text-indigo-200 font-bold" : slot.isDefaultNightSlot ? "text-purple-300 font-semibold" : "text-slate-400 font-medium"}`}>
                            {slot.summary}
                          </p>
                        </div>

                        {(slot.isTimeBlock || slot.isDefaultNightSlot) && (
                          <div className="pl-3">
                            {isSelected ? (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                                <CheckCircle2 className="w-4.5 h-4.5" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full border border-slate-700/80 group-hover:border-indigo-500/60 flex items-center justify-center text-xs text-slate-400 group-hover:text-indigo-400 transition-colors">
                                +
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

