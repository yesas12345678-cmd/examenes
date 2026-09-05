"use client";

import { ExamData, EffortLevel, Priority, ExamType } from "@/types";
import { BookOpen, Calendar, Clock, Flag, Tag } from "lucide-react";

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

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Configuración del Examen</h2>
          <p className="text-xs text-slate-400">Ingresa los detalles para planificar tus sesiones de estudio</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Nombre del Examen */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Nombre del Examen <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Ej: Cálculo Multivariable, Redes de Computadores"
            value={examData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
          />
        </div>

        {/* Fecha del Examen */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            Fecha del Examen <span className="text-rose-400">*</span>
          </label>
          <input
            type="date"
            value={examData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all color-scheme-dark"
          />
        </div>

        {/* Prioridad y Tipo en Grilla */}
        <div className="grid grid-cols-2 gap-4">
          {/* Prioridad */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-rose-400" />
              Prioridad
            </label>
            <select
              value={examData.priority}
              onChange={(e) => handleChange("priority", e.target.value as Priority)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none transition-all"
            >
              <option value="High">Alta (High)</option>
              <option value="Medium">Media (Medium)</option>
              <option value="Low">Baja (Low)</option>
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              Tipo
            </label>
            <select
              value={examData.type}
              onChange={(e) => handleChange("type", e.target.value as ExamType)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none transition-all"
            >
              <option value="Exam">Examen (Exam)</option>
              <option value="Quiz">Prueba Corta (Quiz)</option>
              <option value="Assignment">Tarea/Entrega (Assignment)</option>
              <option value="Project">Proyecto (Project)</option>
            </select>
          </div>
        </div>

        {/* Nivel de Esfuerzo / Sesiones */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Nivel de Esfuerzo / Sesiones de Estudio
          </label>
          <select
            value={examData.effortLevel}
            onChange={(e) => handleChange("effortLevel", e.target.value as EffortLevel)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
          >
            <option value="1_day">1 día (1 sesión = 2 horas consecutivas)</option>
            <option value="2_days">2 días (2 sesiones = 4 horas en 2 bloques de 2h)</option>
            <option value="3_days">3 días (3 sesiones = 6 horas en 3 bloques de 2h)</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
            💡 <strong className="text-slate-300">Regla de Selección:</strong> Cada sesión consiste en <span className="text-indigo-400 font-semibold">2 bloques consecutivos de 1 hora</span>. Al hacer clic en un slot en el calendario, se seleccionará automáticamente la pareja de 2 horas.
          </p>
        </div>
      </div>
    </div>
  );
}
