"use client";

import { ExamData, getRequiredHours } from "@/types";
import { Gamepad2, Calendar, Flame, Zap, ChevronDown } from "lucide-react";

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

  const currentHours = getRequiredHours(examData.effortLevel);

  return (
    <div className="bg-black/90 backdrop-blur-2xl border border-yellow-500/40 hover:border-yellow-400 rounded-3xl p-6 shadow-[0_0_35px_rgba(250,204,21,0.15)] transition-all duration-300 space-y-6">
      {/* Form Header */}
      <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-800">
        <div className="p-3 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
          <Gamepad2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-yellow-400 uppercase tracking-wider">Configuración del Examen</h2>
          <p className="text-xs text-zinc-400 font-medium font-semibold">Define tu misión de estudio para agendar tus bloques</p>
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
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/40 rounded-2xl px-4 py-3.5 text-sm text-yellow-100 placeholder-zinc-600 outline-none transition-all duration-200 shadow-inner font-semibold"
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
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/40 rounded-2xl px-4 py-3.5 text-sm text-yellow-100 outline-none transition-all duration-200 color-scheme-dark shadow-inner font-semibold"
          />
        </div>

        {/* Desplegable de Horas de Estudio */}
        <div>
          <label className="block text-[11px] font-black text-yellow-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-yellow-400" />
            Horas de Estudio Requeridas <span className="text-rose-400">*</span>
          </label>

          <div className="relative">
            <select
              value={currentHours}
              onChange={(e) => handleChange("effortLevel", e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/40 rounded-2xl px-4 py-4 text-sm text-yellow-100 outline-none transition-all duration-200 shadow-inner font-black appearance-none cursor-pointer pr-10"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                <option key={h} value={h} className="bg-zinc-950 text-white font-bold py-2">
                  {h} {h === 1 ? "Hora de estudio" : "Horas de estudio"}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-yellow-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3.5 p-3.5 rounded-2xl bg-yellow-950/20 border border-yellow-500/30 text-xs text-zinc-300 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-zinc-300">
              <strong className="text-yellow-400 font-bold uppercase tracking-wider">Selección Libre (1 a 1):</strong> Elige cuántas horas estudiarás. Luego selecciona los bloques de 1h libremente en el visor. Si escoges horas seguidas, se combinarán automáticamente en tu Google Calendar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
