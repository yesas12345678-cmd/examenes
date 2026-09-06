export type EffortLevel = '1_day' | '2_days' | '3_days'; // 1 sesión (2h), 2 sesiones (4h), 3 sesiones (6h)

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
}

export interface SyncPayload {
  exam: ExamData;
  selectedSlotIds: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
