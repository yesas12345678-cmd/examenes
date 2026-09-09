"use client";

import { useState, useMemo } from "react";
import { Fish, Calendar, Clock, ArrowRight, Anchor, Sparkles, Check, Trash2, Repeat } from "lucide-react";
import { format, addDays, nextSaturday, nextSunday, isSaturday, isSunday } from "date-fns";
import { es } from "date-fns/locale";

interface FishingFormProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
  onRefreshCalendar: () => void;
}

export default function FishingForm({ onSuccess, onError, onRefreshCalendar }: FishingFormProps) {
  // Generar sugerencias de los próximos sábados y domingos (4 semanas)
  const weekendOptions = useMemo(() => {
    const options: { dateStr: string; label: string; dayName: string }[] = [];
    let current = new Date();

    for (let i = 0; i < 28; i++) {
      const d = addDays(current, i);
      if (isSaturday(d) || isSunday(d)) {
        const dateStr = format(d, "yyyy-MM-dd");
        const dayName = isSaturday(d) ? "Sábado" : "Domingo";
        const label = format(d, "EEEE d 'de' MMMM", { locale: es });
        options.push({ dateStr, label: label.charAt(0).toUpperCase() + label.slice(1), dayName });
      }
    }
    return options;
  }, []);

  const [date, setDate] = useState<string>(weekendOptions[0]?.dateStr || new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endTime, setEndTime] = useState<string>("13:00");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manejador del cambio de fecha
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
  };

  // Validar si la fecha elegida es sábado o domingo
  const selectedDateObj = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [date]);

  const isValidWeekend = selectedDateObj ? isSaturday(selectedDateObj) || isSunday(selectedDateObj) : false;

  // Presets de Horario
  const presets = [
    { label: "8:00 - 13:00 (5h)", start: "08:00", end: "13:00" },
    { label: "7:00 - 14:00 (7h)", start: "07:00", end: "14:00" },
    { label: "9:00 - 14:00 (5h)", start: "09:00", end: "14:00" },
    { label: "10:00 - 15:00 (5h)", start: "10:00", end: "15:00" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidWeekend) {
      onError("La jornada de pesca solo puede programarse en Sábado o Domingo.");
      return;
    }

    if (startTime >= endTime) {
      onError("La hora de inicio debe ser anterior a la hora de fin.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/fishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          startTime,
          endTime,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        onSuccess(json.message || "¡Jornada de pesca programada con éxito!");
        onRefreshCalendar();
      } else {
        onError(json.error || "Fallo al programar la jornada de pesca.");
      }
    } catch (err: any) {
      onError("Error de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-black/90 backdrop-blur-2xl border border-rose-500/40 hover:border-rose-400 rounded-3xl p-6 shadow-[0_0_35px_rgba(244,63,94,0.15)] transition-all duration-300 space-y-6">
      {/* Header del Formulario */}
      <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-800">
        <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
          <Fish className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <span>Jornada de Pesca</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Sáb / Dom
            </span>
          </h2>
          <p className="text-xs text-zinc-400 font-medium">Reorganiza y programa tu tiempo libre el fin de semana</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Selección de Fecha */}
        <div className="space-y-2.5">
          <label className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-rose-400" />
            <span>Seleccionar Fin de Semana</span>
          </label>

          {/* Quick Picker Buttons */}
          <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
            {weekendOptions.map((opt) => {
              const isSelected = date === opt.dateStr;
              return (
                <button
                  type="button"
                  key={opt.dateStr}
                  onClick={() => handleDateChange(opt.dateStr)}
                  className={`p-2.5 rounded-xl text-left border transition-all text-xs flex items-center justify-between ${
                    isSelected
                      ? "bg-rose-500/20 border-rose-400 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] font-black"
                      : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-rose-500/40 font-medium"
                  }`}
                >
                  <div className="truncate">
                    <span className={`text-[10px] uppercase block font-black ${opt.dayName === "Sábado" ? "text-rose-400" : "text-amber-400"}`}>
                      {opt.dayName}
                    </span>
                    <span className="truncate">{format(new Date(opt.dateStr.replace(/-/g, "/")), "d 'de' MMM", { locale: es })}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-rose-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Fallback Date Picker Input */}
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-400 text-white rounded-xl p-3 text-xs font-medium focus:outline-none transition-colors"
          />

          {!isValidWeekend && date && (
            <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1.5">
              ⚠️ La fecha elegida no es un sábado ni un domingo.
            </p>
          )}
        </div>

        {/* Selección de Horario */}
        <div className="space-y-2.5">
          <label className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>Horario de Pesca</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Hora Inicio</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-400 text-white rounded-xl p-3 text-xs font-bold focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Hora Fin</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-400 text-white rounded-xl p-3 text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Presets Rápidos */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {presets.map((p, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => {
                  setStartTime(p.start);
                  setEndTime(p.end);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-bold transition-all hover:border-rose-400"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cuadro Reglas de Automatización */}
        <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2 text-xs">
          <div className="text-[11px] font-black text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Automatización Inteligente</span>
          </div>

          <ul className="space-y-1.5 text-[11px] text-zinc-300 font-medium">
            <li className="flex items-start gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Sábado ➔ Domingo</strong> / <strong>Domingo ➔ Sábado</strong>: Las tareas normales se reasignan al otro día al mismo horario.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong>Eliminación directa</strong>: Tareas con nombre <code className="bg-black/60 px-1 py-0.5 rounded text-rose-300">getupp</code>, <code className="bg-black/60 px-1 py-0.5 rounded text-rose-300">artefactos a mano</code> o <code className="bg-black/60 px-1 py-0.5 rounded text-rose-300">Estudio: b2</code> se eliminan.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Anchor className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Eventos creados: <strong>Evento horario en rojo</strong> (+ notificación) + <strong>Evento All-Day</strong> (ej: <em className="text-white">jornada de pesca 8-13</em>).
              </span>
            </li>
          </ul>
        </div>

        {/* Botón Acción Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !isValidWeekend}
          className="w-full py-4 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_0_25px_rgba(244,63,94,0.4)] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 border border-rose-400"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Procesando Jornada...</span>
            </>
          ) : (
            <>
              <Fish className="w-4 h-4" />
              <span>Programar Jornada de Pesca</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
