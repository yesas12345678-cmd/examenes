"use client";

import { ExamData, EffortLevel } from "@/types";
import { BookOpen, Calendar, Clock, Flame, CheckCircle2, Zap } from "lucide-react";

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
  }[] = [
    {
      id: "1_day",
      badge: "🥇 Leve",
      title: "1 Día",
      hours: "2 Horas Total",
      description: "1 sesión de 2h consecutivas",
    },
    {
      id: "2_days",
      badge: "🥈 Medio",
      title: "2 Días",
      hours: "4 Horas Total",
      description: "2 sesiones de 2h (4h en total)",
    },
    {
      id: "3_days",
      badge: "🥉 Intensivo",
      title: "3 Días",
      hours: "6 Horas Total",
      description: "3 sesiones de 2h (6h en total)",
    },
  ];

  return (
    <div className="bg-slate-900/60 backdrop-blur-2xl border border-slate-800/90 hover:border-indigo-500/30 rounded-3xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-300 space-y-6">
      {/* Form Header */}
      <div className="flex items-center gap-3.5 pb-4 border-b border-slate-800/80">
        <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100 tracking-tight">Configuración del Examen</h2>
          <p className="text-xs text-slate-400">Detalla tu objetivo para estructurar tus bloques de estudio</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Nombre del Examen */}
        <div>
          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
            Nombre del Examen <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Ej: Cálculo Multivariable, Redes de Computadores"
              value={examData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800/90 focus:border-indigo-500 focus:ring-2 focus:ring-purple-500/30 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-200 shadow-inner"
            />
          </div>
        </div>

        {/* Fecha del Examen */}
        <div>
          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            Fecha del Examen <span className="text-rose-400">*</span>
          </label>
          <input
            type="date"
            value={examData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800/90 focus:border-indigo-500 focus:ring-2 focus:ring-purple-500/30 rounded-2xl px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-200 color-scheme-dark shadow-inner"
          />
        </div>

        {/* Nivel de Esfuerzo / Tarjetas Interactivas */}
        <div>
          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Nivel de Esfuerzo / Sesiones de Estudio
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {effortOptions.map((opt) => {
              const isSelected = examData.effortLevel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleChange("effortLevel", opt.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden group active:scale-95 ${
                    isSelected
                      ? "bg-gradient-to-b from-indigo-950/60 to-purple-950/40 border-indigo-500/80 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/50"
                      : "bg-slate-950/60 hover:bg-slate-900/80 border-slate-800/80 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-800/80 text-indigo-300 border border-slate-700/50">
                      {opt.badge}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{opt.title}</h3>
                  <p className="text-[11px] font-medium text-indigo-300/90 mt-0.5">{opt.hours}</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">{opt.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-3.5 p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-slate-300 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-300">
              <strong className="text-indigo-300 font-semibold">Regla de Parejas Consecutivas:</strong> Cada sesión asigna automáticamente <span className="text-white font-bold">2 horas libres consecutivas</span> al presionar cualquier bloque en el visor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

