"use client";

import { useState } from "react";
import { CalendarSlot, EffortLevel } from "@/types";
import { Calendar as CalendarIcon, CheckCircle2, Clock, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { format, parseISO, isSameDay, addHours, differenceInMinutes } from "date-fns";
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
  const [filterTimeBlocksOnly, setFilterTimeBlocksOnly] = useState<boolean>(true);

  // Determinar max bloques permitidos según nivel de esfuerzo
  const requiredSlotsMap: Record<EffortLevel, number> = {
    "1_day": 2,
    "2_days": 4,
    "3_days": 6,
  };
  const maxSlots = requiredSlotsMap[effortLevel];
  const maxSessions = maxSlots / 2;

  // Filtrar eventos si se desea ver solo Time Blocks libres
  const displayedEvents = filterTimeBlocksOnly
    ? events.filter((e) => e.isTimeBlock)
    : events;

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
      if (e.id === targetSlot.id || !e.isTimeBlock) return false;
      const start = parseISO(e.start);
      return Math.abs(differenceInMinutes(start, targetEnd)) <= 5;
    });

    if (nextSlot) return nextSlot;

    // Si no hay siguiente, buscar bloque que termine justo cuando empiece targetSlot (hora anterior)
    const prevSlot = events.find((e) => {
      if (e.id === targetSlot.id || !e.isTimeBlock) return false;
      const end = parseISO(e.end);
      return Math.abs(differenceInMinutes(end, targetStart)) <= 5;
    });

    return prevSlot || null;
  };

  /**
   * Manejador al hacer clic en un bloque de 1 hora
   */
  const handleSlotClick = (slot: CalendarSlot) => {
    if (!slot.isTimeBlock) return;

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

    // Eliminar duplicados si alguno ya estuviera seleccionado
    pairIds.forEach((id) => {
      if (!newSelected.includes(id)) {
        newSelected.push(id);
      }
    });

    // Si excede el máximo de bloques, descartar la pareja más antigua
    if (newSelected.length > maxSlots) {
      // Conservar las parejas más recientes
      newSelected = newSelected.slice(newSelected.length - maxSlots);
    }

    onSelectSlots(newSelected);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full min-h-[500px]">
      {/* Header del Calendario */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Visor de Time Blocking</h2>
            <p className="text-xs text-slate-400">
              Eventos de Google Calendar (próximos 14 días)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterTimeBlocksOnly(!filterTimeBlocksOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterTimeBlocksOnly
                ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            {filterTimeBlocksOnly ? "Mostrando Libres" : "Mostrar Todos"}
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
            title="Recargar eventos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Banner de Estado de Selección */}
      <div className="mt-4 p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 text-indigo-200">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>
            Objetivo: <strong className="text-white">{maxSessions} sesión(es)</strong> = <strong className="text-white">{maxSlots} bloques (horas)</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-semibold">
          <span className={selectedSlotIds.length === maxSlots ? "text-emerald-400" : "text-amber-400"}>
            Seleccionados: {selectedSlotIds.length} / {maxSlots} bloques ({selectedSlotIds.length / 2} de {maxSessions} sesiones)
          </span>
          {selectedSlotIds.length === maxSlots && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
          )}
        </div>
      </div>

      {/* Lista de Eventos y Bloques */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-5 max-h-[550px] custom-scrollbar">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-sm text-slate-400">Cargando eventos de Google Calendar...</p>
          </div>
        ) : Object.keys(groupedEvents).length === 0 ? (
          <div className="py-16 text-center space-y-2 bg-slate-950/40 rounded-xl border border-slate-800">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-medium text-slate-300">No se encontraron eventos de Time Blocking libres</p>
            <p className="text-xs text-slate-500">Asegúrate de tener bloques vacíos en tu Google Calendar en los próximos 14 días.</p>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([dateStr, daySlots]) => {
            const dateObj = parseISO(dateStr);
            const formattedDate = format(dateObj, "EEEE d 'de' MMMM", { locale: es });

            return (
              <div key={dateStr} className="space-y-2">
                <div className="text-xs font-semibold text-indigo-300 capitalize flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  {formattedDate}
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
                        className={`p-3 rounded-xl border text-left transition-all duration-200 flex items-center justify-between group ${
                          isSelected
                            ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                            : slot.isTimeBlock
                            ? "bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-200"
                            : "bg-slate-950/30 border-slate-900 text-slate-500 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <Clock className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-400" : "text-slate-400"}`} />
                            <span>{startTime} - {endTime}</span>
                          </div>
                          <p className={`text-xs ${isSelected ? "text-indigo-200 font-semibold" : "text-slate-400"}`}>
                            {slot.summary}
                          </p>
                        </div>

                        {slot.isTimeBlock && (
                          <div className="pl-2">
                            {isSelected ? (
                              <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full border border-slate-700 group-hover:border-slate-500 flex items-center justify-center text-[10px] text-slate-500">
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
