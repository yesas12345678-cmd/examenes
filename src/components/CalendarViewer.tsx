"use client";

import { CalendarSlot, EffortLevel } from "@/types";
import { Gamepad2, CheckCircle2, Clock, RefreshCw, AlertCircle, Moon, Trophy, Fish, Lock } from "lucide-react";
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
  // Determinar max bloques permitidos según nivel de esfuerzo
  const requiredSlotsMap: Record<EffortLevel, number> = {
    "1_day": 2,
    "2_days": 4,
    "3_days": 6,
  };
  const maxSlots = requiredSlotsMap[effortLevel];
  const maxSessions = maxSlots / 2;

  // Todos los eventos para el desglose diario
  const displayedEvents = events;

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

    const nextSlot = events.find((e) => {
      if (e.id === targetSlot.id || (!e.isTimeBlock && !e.isDefaultNightSlot)) return false;
      const start = parseISO(e.start);
      return Math.abs(differenceInMinutes(start, targetEnd)) <= 5;
    });

    if (nextSlot) return nextSlot;

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
      const sibling = findConsecutiveSlot(slot);
      const idsToRemove = [slot.id, sibling?.id].filter(Boolean) as string[];
      onSelectSlots(selectedSlotIds.filter((id) => !idsToRemove.includes(id)));
      return;
    }

    const sibling = findConsecutiveSlot(slot);

    if (!sibling) {
      alert("⚠️ Para cumplir la regla de 1 sesión (2 horas), debes seleccionar un bloque que tenga otra hora libre consecutiva inmediatamente antes o después.");
      return;
    }

    const pairIds = [slot.id, sibling.id];

    let newSelected = [...selectedSlotIds];

    pairIds.forEach((id) => {
      if (!newSelected.includes(id)) {
        newSelected.push(id);
      }
    });

    if (newSelected.length > maxSlots) {
      newSelected = newSelected.slice(newSelected.length - maxSlots);
    }

    onSelectSlots(newSelected);
  };

  return (
    <div className="bg-black/90 backdrop-blur-2xl border border-yellow-500/40 hover:border-yellow-400 rounded-3xl p-6 shadow-[0_0_35px_rgba(250,204,21,0.15)] transition-all duration-300 flex flex-col h-full min-h-[550px]">
      {/* Header del Visor */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800 flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-yellow-400 uppercase tracking-wider">Visor de Time Blocking</h2>
            <p className="text-xs text-zinc-400 font-medium">
              Bloques libres disponibles (incluyendo noches de 21:10-23:00 en L, M, X, J)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-zinc-950 hover:bg-zinc-900 text-yellow-400 rounded-xl transition-all duration-200 border border-zinc-800 hover:border-yellow-500/40 disabled:opacity-50 active:scale-95 shadow-inner"
            title="Recargar eventos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-yellow-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Banner de Estado de Selección */}
      <div className="mt-4 p-3.5 rounded-2xl bg-yellow-950/20 border border-yellow-500/30 flex items-center justify-between flex-wrap gap-2 text-xs shadow-inner">
        <div className="flex items-center gap-2 text-yellow-300">
          <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="font-bold uppercase tracking-wider">
            Misión: <strong className="text-white font-black">{maxSessions} sesión(es)</strong> = <strong className="text-white font-black">{maxSlots} horas</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-black uppercase tracking-wider">
          <span className={selectedSlotIds.length === maxSlots ? "text-yellow-400" : "text-amber-400"}>
            Completado: {selectedSlotIds.length} / {maxSlots} horas
          </span>
          {selectedSlotIds.length === maxSlots && (
            <CheckCircle2 className="w-4 h-4 text-yellow-400 inline" />
          )}
        </div>
      </div>

      {/* Lista de Eventos y Bloques Libres */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-5 max-h-[520px] custom-scrollbar">
        {isLoading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Cargando eventos de Google Calendar...</p>
          </div>
        ) : Object.keys(groupedEvents).length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-zinc-950 rounded-2xl border border-zinc-800 p-6">
            <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-yellow-300 uppercase tracking-wide">Sin bloques libres disponibles</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto font-medium">
              Asegúrate de tener espacio libre o eventos formateados en tu Google Calendar en los próximos 14 días.
            </p>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([dateStr, daySlots]) => {
            const dateObj = parseISO(dateStr);
            const formattedDate = format(dateObj, "EEEE d 'de' MMMM", { locale: es });

            return (
              <div key={dateStr} className="space-y-2.5">
                <div className="text-xs font-black text-yellow-400 capitalize flex items-center justify-between tracking-wider uppercase">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,1)]" />
                    {formattedDate}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {daySlots.map((slot) => {
                    const isSelected = selectedSlotIds.includes(slot.id);
                    const startTime = format(parseISO(slot.start), "HH:mm");
                    const endTime = format(parseISO(slot.end), "HH:mm");

                    if (slot.isFishing) {
                      return (
                        <div
                          key={slot.id}
                          className="p-3.5 rounded-2xl border bg-rose-950/40 border-rose-500/50 text-rose-200 flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-black text-rose-400">
                              <Fish className="w-3.5 h-3.5 text-rose-400" />
                              <span className="tracking-wide">{startTime} - {endTime}</span>
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-wider border border-rose-500/40 flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.3)]">
                                Pesca 🎣
                              </span>
                            </div>
                            <p className="text-xs font-black text-rose-200">
                              {slot.summary}
                            </p>
                          </div>
                        </div>
                      );
                    }



                    return (
                      <button
                        key={slot.id}
                        onClick={() => handleSlotClick(slot)}
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between group active:scale-95 ${
                          isSelected
                            ? "bg-yellow-400/20 border-yellow-400 text-white shadow-[0_0_25px_rgba(250,204,21,0.35)] ring-1 ring-yellow-400"
                            : slot.isDefaultNightSlot
                            ? "bg-yellow-950/20 hover:bg-yellow-900/30 border-yellow-600/40 text-yellow-200"
                            : "bg-zinc-950 hover:bg-zinc-900 border-zinc-800 hover:border-yellow-500/40 text-zinc-200"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-black">
                            <Clock className={`w-3.5 h-3.5 ${isSelected ? "text-yellow-400" : slot.isDefaultNightSlot ? "text-yellow-400" : "text-zinc-500"}`} />
                            <span className="tracking-wide">{startTime} - {endTime}</span>
                            {slot.isDefaultNightSlot && (
                              <span className="px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 text-[10px] font-black uppercase tracking-wider border border-yellow-400/40 flex items-center gap-1 shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                                <Moon className="w-2.5 h-2.5 text-yellow-400" /> Noche
                              </span>
                            )}
                          </div>
                          <p className={`text-xs ${isSelected ? "text-yellow-300 font-black" : slot.isDefaultNightSlot ? "text-yellow-200 font-bold" : "text-zinc-400 font-semibold"}`}>
                            {slot.summary}
                          </p>
                        </div>

                        <div className="pl-3">
                          {isSelected ? (
                            <div className="w-7 h-7 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.8)]">
                              <CheckCircle2 className="w-4.5 h-4.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full border border-zinc-800 group-hover:border-yellow-400 flex items-center justify-center text-xs text-zinc-500 group-hover:text-yellow-400 transition-colors font-black">
                              +
                            </div>
                          )}
                        </div>
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
