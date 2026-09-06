import { google } from "googleapis";
import { CalendarSlot } from "@/types";

export function getGoogleCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Genera un ISO String formateado explícitamente para España (+02:00 CEST)
 * evitando que el servidor en UTC de Vercel desplace la hora al navegador.
 */
function createSpainIsoString(year: number, month: number, day: number, hours: number, minutes: number = 0) {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+02:00`;
}

/**
 * Obtiene los eventos de los próximos X días de Google Calendar
 * e inyecta las sesiones fijas de 21:10 - 22:00 y 22:00 - 23:00
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
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;

      const start2110 = createSpainIsoString(year, month, dateNum, 21, 10);
      const end2200 = createSpainIsoString(year, month, dateNum, 22, 0);

      const start2200 = createSpainIsoString(year, month, dateNum, 22, 0);
      const end2300 = createSpainIsoString(year, month, dateNum, 23, 0);

      // Comprobar si ya existe evento mapeado para 21:10 - 22:00
      const existing2110 = mappedEvents.find((e) => {
        if (!e.start) return false;
        const eStart = new Date(e.start);
        const targetStart = new Date(start2110);
        return Math.abs(eStart.getTime() - targetStart.getTime()) < 15 * 60 * 1000;
      });

      if (existing2110) {
        existing2110.isDefaultNightSlot = true;
      } else {
        virtualSlots.push({
          id: `virtual_2110_${dateStr}`,
          summary: "Bloque Noche (21:10 - 22:00)",
          start: start2110,
          end: end2200,
          isTimeBlock: true,
          isVirtual: true,
          isDefaultNightSlot: true,
        });
      }

      // Comprobar si ya existe evento mapeado para 22:00 - 23:00
      const existing2200 = mappedEvents.find((e) => {
        if (!e.start) return false;
        const eStart = new Date(e.start);
        const targetStart = new Date(start2200);
        return Math.abs(eStart.getTime() - targetStart.getTime()) < 15 * 60 * 1000;
      });

      if (existing2200) {
        existing2200.isDefaultNightSlot = true;
      } else {
        virtualSlots.push({
          id: `virtual_2200_${dateStr}`,
          summary: "Bloque Noche (22:00 - 23:00)",
          start: start2200,
          end: end2300,
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
 * Procesa la sincronización de un bloque.
 * Elimina automáticamente eventos conflictivos existentes en la ventana 21:00 - 23:05 de ese día
 * (como pc, lecture, descanso, acotame) y crea el bloque de estudio.
 */
export async function syncSlotInstance(
  accessToken: string,
  slotId: string,
  examName: string,
  allSlots: CalendarSlot[] = []
): Promise<any> {
  const calendar = getGoogleCalendarClient(accessToken);
  const newSummary = `Estudio: ${examName}`;

  const targetSlot = allSlots.find((s) => s.id === slotId);

  let startIso = targetSlot?.start;
  let endIso = targetSlot?.end;

  if (slotId.startsWith("virtual_")) {
    const parts = slotId.split("_");
    const code = parts[1]; // "2110" or "2200"
    const dateStr = parts[2];
    const [year, month, day] = dateStr.split("-").map(Number);

    if (code === "2110") {
      startIso = createSpainIsoString(year, month - 1, day, 21, 10);
      endIso = createSpainIsoString(year, month - 1, day, 22, 0);
    } else {
      startIso = createSpainIsoString(year, month - 1, day, 22, 0);
      endIso = createSpainIsoString(year, month - 1, day, 23, 0);
    }
  }

  // 1. Limpiar/eliminar cualquier evento existente en Google Calendar en la ventana 21:00 a 23:05 de ese día
  if (startIso && endIso) {
    try {
      const slotStartDate = new Date(startIso);
      const windowStart = createSpainIsoString(
        slotStartDate.getFullYear(),
        slotStartDate.getMonth(),
        slotStartDate.getDate(),
        21,
        0
      );
      const windowEnd = createSpainIsoString(
        slotStartDate.getFullYear(),
        slotStartDate.getMonth(),
        slotStartDate.getDate(),
        23,
        5
      );

      const existingInWindow = await calendar.events.list({
        calendarId: "primary",
        timeMin: windowStart,
        timeMax: windowEnd,
        singleEvents: true,
      });

      const eventsToDelete = existingInWindow.data.items || [];
      for (const ev of eventsToDelete) {
        if (ev.id && !ev.summary?.startsWith("Estudio:")) {
          try {
            await calendar.events.delete({
              calendarId: "primary",
              eventId: ev.id,
            });
            console.log(`Evento conflictivo eliminado (${ev.summary || "Sin título"} - ID: ${ev.id})`);
          } catch (delErr) {
            console.warn(`No se pudo eliminar evento previo ${ev.id}:`, delErr);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Fallo en la limpieza previa de eventos conflictivos:", cleanErr);
    }
  }

  // 2. Crear o actualizar el evento en Google Calendar
  if (startIso && endIso) {
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

  // Fallback si fuera un ID de evento regular
  const response = await calendar.events.patch({
    calendarId: "primary",
    eventId: slotId,
    requestBody: {
      summary: newSummary,
    },
  });

  return response.data;
}
