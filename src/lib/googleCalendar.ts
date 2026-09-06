import { google } from "googleapis";
import { CalendarSlot } from "@/types";

export function getGoogleCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Obtiene los eventos de los próximos X días de Google Calendar
 * e inyecta los bloques de noche predeterminados (21:00-22:00 y 22:00-23:00)
 * para Lunes, Martes, Miércoles, Jueves y Domingo.
 */
export async function getUpcomingCalendarEvents(
  accessToken: string,
  daysAhead: number = 14
): Promise<CalendarSlot[]> {
  const calendar = getGoogleCalendarClient(accessToken);
  const now = new Date();
  const timeMin = now.toISOString();

  const future = new Date();
  future.setDate(now.getDate() + daysAhead);
  const timeMax = future.toISOString();

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true, // Expande las series recurrentes en instancias individuales
    orderBy: "startTime",
  });

  const items = response.data.items || [];

  // Mapear eventos reales devueltos por Google
  const mappedEvents: CalendarSlot[] = items.map((item) => {
    const summary = item.summary ? item.summary.trim() : "";
    const lowerSummary = summary.toLowerCase();
    const isTimeBlock =
      summary === "" ||
      lowerSummary === "timeblock" ||
      lowerSummary === "time block" ||
      lowerSummary === "libre" ||
      lowerSummary === "disponible" ||
      lowerSummary === "bloque de estudio" ||
      lowerSummary === "(sin título)" ||
      lowerSummary === "no title";

    return {
      id: item.id || "",
      summary: summary || "Bloque Libre",
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || "",
      recurringEventId: item.recurringEventId || undefined,
      isTimeBlock,
      isVirtual: false,
    };
  });

  // Días permitidos: Domingo (0), Lunes (1), Martes (2), Miércoles (3), Jueves (4)
  const allowedDays = [0, 1, 2, 3, 4];
  const virtualSlots: CalendarSlot[] = [];

  for (let d = 0; d < daysAhead; d++) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const dayOfWeek = dayDate.getDay();

    if (allowedDays.includes(dayOfWeek)) {
      const year = dayDate.getFullYear();
      const month = dayDate.getMonth();
      const dateNum = dayDate.getDate();

      const start21 = new Date(year, month, dateNum, 21, 0, 0, 0);
      const end21 = new Date(year, month, dateNum, 22, 0, 0, 0);

      const start22 = new Date(year, month, dateNum, 22, 0, 0, 0);
      const end22 = new Date(year, month, dateNum, 23, 0, 0, 0);

      // Comprobar si ya existe evento real en el bloque 21:00-22:00
      const existing21 = mappedEvents.find((e) => {
        if (!e.start) return false;
        const eStart = new Date(e.start);
        return Math.abs(eStart.getTime() - start21.getTime()) < 15 * 60 * 1000;
      });

      if (existing21) {
        existing21.isDefaultNightSlot = true;
      } else {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;
        virtualSlots.push({
          id: `virtual_21_${dateStr}`,
          summary: "Bloque Libre Noche (21:00 - 22:00)",
          start: start21.toISOString(),
          end: end21.toISOString(),
          isTimeBlock: true,
          isVirtual: true,
          isDefaultNightSlot: true,
        });
      }

      // Comprobar si ya existe evento real en el bloque 22:00-23:00
      const existing22 = mappedEvents.find((e) => {
        if (!e.start) return false;
        const eStart = new Date(e.start);
        return Math.abs(eStart.getTime() - end21.getTime()) < 15 * 60 * 1000;
      });

      if (existing22) {
        existing22.isDefaultNightSlot = true;
      } else {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;
        virtualSlots.push({
          id: `virtual_22_${dateStr}`,
          summary: "Bloque Libre Noche (22:00 - 23:00)",
          start: start22.toISOString(),
          end: end22.toISOString(),
          isTimeBlock: true,
          isVirtual: true,
          isDefaultNightSlot: true,
        });
      }
    }
  }

  // Combinar eventos reales y virtuales ordenados por hora de inicio
  const allEvents = [...mappedEvents, ...virtualSlots];
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return allEvents;
}

/**
 * Procesa la sincronización de un bloque (existente o virtual).
 * Si es un bloque de noche o tiene eventos conflictivos en esa ventana de 21:00-23:00,
 * elimina primero cualquier evento que exista en esas 2 horas y crea/actualiza el evento de estudio.
 */
export async function syncSlotInstance(
  accessToken: string,
  slotId: string,
  examName: string,
  allSlots: CalendarSlot[] = []
): Promise<any> {
  const calendar = getGoogleCalendarClient(accessToken);
  const newSummary = `Estudio: ${examName}`;

  // Buscar metadatos del slot si fue enviado o es virtual
  const targetSlot = allSlots.find((s) => s.id === slotId);

  // Si es un slot virtual o un ID con formato virtual_XX_YYYY-MM-DD
  if (slotId.startsWith("virtual_") || targetSlot?.isVirtual) {
    let startIso = targetSlot?.start;
    let endIso = targetSlot?.end;

    if (!startIso || !endIso) {
      // Reconstruir start/end del ID (ej: virtual_21_2026-09-07)
      const parts = slotId.split("_");
      const hour = parseInt(parts[1], 10);
      const dateStr = parts[2];
      const [year, month, day] = dateStr.split("-").map(Number);

      const startDate = new Date(year, month - 1, day, hour, 0, 0, 0);
      const endDate = new Date(year, month - 1, day, hour + 1, 0, 0, 0);
      startIso = startDate.toISOString();
      endIso = endDate.toISOString();
    }

    // 1. Limpiar/eliminar cualquier evento existente en Google Calendar en esa ventana horaria
    try {
      const existingInWindow = await calendar.events.list({
        calendarId: "primary",
        timeMin: startIso,
        timeMax: endIso,
        singleEvents: true,
      });

      const eventsToDelete = existingInWindow.data.items || [];
      for (const ev of eventsToDelete) {
        if (ev.id) {
          try {
            await calendar.events.delete({
              calendarId: "primary",
              eventId: ev.id,
            });
          } catch (delErr) {
            console.warn(`No se pudo eliminar evento previo ${ev.id}:`, delErr);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Fallo en la limpieza previa de eventos conflictivos:", cleanErr);
    }

    // 2. Crear el nuevo evento en Google Calendar
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: newSummary,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
      },
    });

    return response.data;
  }

  // Si es un bloque de evento existente en Google Calendar (no virtual)
  try {
    const response = await calendar.events.patch({
      calendarId: "primary",
      eventId: slotId,
      requestBody: {
        summary: newSummary,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(`Error actualizando instancia de Google Calendar (${slotId}):`, error);
    throw new Error(
      error.message || `No se pudo actualizar el bloque de calendario ID ${slotId}`
    );
  }
}
