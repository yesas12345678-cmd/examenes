"use client";

import { ExamData, EffortLevel } from "@/types";
import { Gamepad2, Calendar, Flame, CheckCircle2, Zap, Swords, Crown } from "lucide-react";

interface ExamFormProps {
  examData: ExamData;
  onChange: (data: ExamData) => void;
}

export default function ExamForm({ examData, onChange }: ExamFormProps) {
  const handleChange = (field: keyof ExamData, value: any) => {
    onChange({
      ...examData,
      [field]: value,
    });
  };

  const effortOptions: {
    id: EffortLevel;
    badge: string;
    title: string;
    hours: string;
    description: string;
    icon: any;
  }[] = [
    {
      id: "1_day",
      badge: "LVL 1",
      title: "1 Día",
      hours: "2 HORAS TOTAL",
      description: "1 sesión de 2h consecutivas",
      icon: Gamepad2,
    },
    {
      id: "2_days",
      badge: "LVL 2",
      title: "2 Días",
      hours: "4 HORAS TOTAL",
      description: "2 sesiones de 2h (4h en total)",
      icon: Swords,
    },
    {
      id: "3_days",
      badge: "LVL 3",
      title: "3 Días",
      hours: "6 HORAS TOTAL",
      description: "3 sesiones de 2h (6h en total)",
      icon: Crown,
    },
  ];

  return (
    <div className="bg-black/90 backdrop-blur-2xl border border-yellow-500/40 hover:border-yellow-400 rounded-3xl p-6 shadow-[0_0_35px_rgba(250,204,21,0.15)] transition-all duration-300 space-y-6">
      {/* Form Header */}
      <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-800">
        <div className="p-3 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
          <Gamepad2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-yellow-400 uppercase tracking-wider">Configuración del Examen</h2>
          <p className="text-xs text-zinc-400 font-medium">Define tu misión de estudio para agendar tus bloques</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Nombre del Examen */}
        <div>
          <label className="block text-[11px] font-black text-yellow-300 uppercase tracking-widest mb-2">
            Nombre del Examen <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Ej: Cálculo Multivariable, Redes de Computadores"
              value={examData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/40 rounded-2xl px-4 py-3 text-sm text-yellow-100 placeholder-zinc-600 outline-none transition-all duration-200 shadow-inner font-semibold"
            />
          </div>
        </div>

        {/* Fecha del Examen */}
        <div>
          <label className="block text-[11px] font-black text-yellow-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-yellow-400" />
            Fecha del Examen <span className="text-rose-400">*</span>
          </label>
          <input
            type="date"
            value={examData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/40 rounded-2xl px-4 py-3 text-sm text-yellow-100 outline-none transition-all duration-200 color-scheme-dark shadow-inner font-semibold"
          />
        </div>

        {/* Nivel de Esfuerzo / Tarjetas Arcade */}
        <div>
          <label className="block text-[11px] font-black text-yellow-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-yellow-400" />
            Nivel de Dificultad / Sesiones de Estudio
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {effortOptions.map((opt) => {
              const isSelected = examData.effortLevel === opt.id;
              const IconComp = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleChange("effortLevel", opt.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden group active:scale-95 ${
                    isSelected
                      ? "bg-yellow-400/15 border-yellow-400 text-white shadow-[0_0_20px_rgba(250,204,21,0.3)] ring-1 ring-yellow-400/60"
                      : "bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-yellow-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/40">
                      {opt.badge}
                    </span>
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0" />
                    ) : (
                      <IconComp className="w-3.5 h-3.5 text-zinc-500 group-hover:text-yellow-400 transition-colors" />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wide">{opt.title}</h3>
                  <p className="text-[10px] font-bold text-yellow-400 mt-0.5 tracking-wider">{opt.hours}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">{opt.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-3.5 p-3 rounded-2xl bg-yellow-950/20 border border-yellow-500/30 text-xs text-zinc-300 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-zinc-300">
              <strong className="text-yellow-400 font-bold uppercase tracking-wider">Regla de Parejas Consecutivas:</strong> Cada sesión asigna automáticamente <span className="text-white font-bold">2 horas libres consecutivas</span> al marcar cualquier bloque.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


