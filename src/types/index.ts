export type EffortLevel = string | number;

export function getRequiredHours(effortLevel: string | number | undefined | null): number {
  if (effortLevel === undefined || effortLevel === null) return 2;
  if (typeof effortLevel === "number") return effortLevel;
  const parsed = parseInt(effortLevel, 10);
  if (!isNaN(parsed)) return parsed;
  const legacyMap: Record<string, number> = {
    "1_day": 2,
    "2_days": 4,
    "3_days": 6,
  };
  return legacyMap[effortLevel] || 2;
}

export interface ExamData {
  name: string;
  date: string; // YYYY-MM-DD
  effortLevel: EffortLevel;
}

export interface CalendarSlot {
  id: string;
  summary: string;
  start: string; // ISO String
  end: string;   // ISO String
  recurringEventId?: string;
  isTimeBlock: boolean; // Evento vacío o reservado para time blocking
  isVirtual?: boolean;  // Bloque por defecto no creado aún en Google Calendar
  isDefaultNightSlot?: boolean; // Bloque predeterminado de noche (21:00-23:00)
  isFishing?: boolean;  // Evento de Jornada de Pesca
  isOccupied?: boolean; // Tarea u ocupación en esa franja
}

export interface SyncPayload {
  exam: ExamData;
  selectedSlotIds: string[];
  allSlots?: CalendarSlot[]; // Opcional para pasar la lista completa de slots con sus metas
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
