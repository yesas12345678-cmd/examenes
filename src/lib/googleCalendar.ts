import { google } from "googleapis";
import { CalendarSlot, ExamData } from "@/types";

export function getGoogleCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Formatea una fecha local como string ISO sin offset (ej: 2026-09-07T21:10:00)
 */
function createNaiveLocalIsoString(year: number, month: number, day: number, hours: number, minutes: number = 0) {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
}

/**
 * Formatea una fecha con el offset de España (+02:00) para enviar a Google Calendar API
 */
function createSpainIsoString(year: number, month: number, day: number, hours: number, minutes: number = 0) {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+02:00`;
}

/**
 * Busca si existe el calendario secundario 'examenes' (o 'exámenes').
 * Si no existe, lo crea automáticamente en la cuenta de Google del usuario.
 */
export async function getOrCreateExamenesCalendarId(accessToken: string): Promise<string> {
  const calendar = getGoogleCalendarClient(accessToken);

  try {
    const listResponse = await calendar.calendarList.list();
    const calendars = listResponse.data.items || [];

    const examenesCal = calendars.find(
      (c) =>
        c.summary &&
        (c.summary.toLowerCase().trim() === "examenes" || c.summary.toLowerCase().trim() === "exámenes")
    );

    if (examenesCal && examenesCal.id) {
      return examenesCal.id;
    }

    // Si no existe el calendario secundario, lo creamos
    const newCalResponse = await calendar.calendars.insert({
      requestBody: {
        summary: "examenes",
        timeZone: "Europe/Madrid",
      },
    });

    return newCalResponse.data.id || "primary";
  } catch (error) {
    console.warn("Fallo buscando o creando calendario 'examenes', se usará el primario:", error);
    return "primary";
  }
}

/**
 * Crea el evento de Todo el Día (All-day) para el Examen en el calendario 'examenes'.
 */
export async function createAllDayExamEvent(accessToken: string, exam: ExamData) {
  const calendar = getGoogleCalendarClient(accessToken);
  const calendarId = await getOrCreateExamenesCalendarId(accessToken);

  try {
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: `Examen: ${exam.name}`,
        start: {
          date: exam.date, // YYYY-MM-DD formato de Todo el Día
        },
        end: {
          date: exam.date,
        },
        colorId: "11", // Color Rojo (Tomato) para destacar el día del examen
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 540 }, // Recordatorio a las 9:00 AM del día del examen
          ],
        },
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("Error creando el evento All-Day de examen:", error);
    throw new Error(error.message || "No se pudo crear el evento de todo el día para el examen.");
  }
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
    singleEvents: true,
    orderBy: "startTime",
  });

  const items = response.data.items || [];

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

      const start2110 = createNaiveLocalIsoString(year, month, dateNum, 21, 10);
      const end2200 = createNaiveLocalIsoString(year, month, dateNum, 22, 0);

      const start2200 = createNaiveLocalIsoString(year, month, dateNum, 22, 0);
      const end2300 = createNaiveLocalIsoString(year, month, dateNum, 23, 0);

      const existing2110 = mappedEvents.find((e) => {
        if (!e.start) return false;
        const eStart = new Date(e.start);
        const targetStart = new Date(createSpainIsoString(year, month, dateNum, 21, 10));
        return Math.abs(eStart.getTime() - targetStart.getTime()) < 20 * 60 * 1000;
      });

      if (existing2110) {
        existing2110.isDefaultNightSlot = true;
        existing2110.start = start2110;
        existing2110.end = end2200;
        existing2110.isTimeBlock = true;
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

      const existing2200 = mappedEvents.find((e) => {
        if (!e.start) return false;
        const eStart = new Date(e.start);
        const targetStart = new Date(createSpainIsoString(year, month, dateNum, 22, 0));
        return Math.abs(eStart.getTime() - targetStart.getTime()) < 20 * 60 * 1000;
      });

      if (existing2200) {
        existing2200.isDefaultNightSlot = true;
        existing2200.start = start2200;
        existing2200.end = end2300;
        existing2200.isTimeBlock = true;
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

  const allEvents = [...mappedEvents, ...virtualSlots];
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return allEvents;
}

/**
 * Procesa la sincronización de un bloque de estudio.
 * - Cambia el color a Azul (colorId: "9")
 * - Configura el recordatorio exactamente al inicio del evento (0 minutos antes)
 * - Elimina eventos conflictivos previos en la franja de noche de ese día
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
    const code = parts[1];
    const dateStr = parts[2];
    const [year, month, day] = dateStr.split("-").map(Number);

    if (code === "2110") {
      startIso = createSpainIsoString(year, month - 1, day, 21, 10);
      endIso = createSpainIsoString(year, month - 1, day, 22, 0);
    } else {
      startIso = createSpainIsoString(year, month - 1, day, 22, 0);
      endIso = createSpainIsoString(year, month - 1, day, 23, 0);
    }
  } else if (startIso && !startIso.includes("+") && !startIso.includes("Z")) {
    if (startIso.includes("T21:10")) {
      const parts = startIso.split("T")[0].split("-").map(Number);
      startIso = createSpainIsoString(parts[0], parts[1] - 1, parts[2], 21, 10);
      endIso = createSpainIsoString(parts[0], parts[1] - 1, parts[2], 22, 0);
    } else if (startIso.includes("T22:00")) {
      const parts = startIso.split("T")[0].split("-").map(Number);
      startIso = createSpainIsoString(parts[0], parts[1] - 1, parts[2], 22, 0);
      endIso = createSpainIsoString(parts[0], parts[1] - 1, parts[2], 23, 0);
    } else {
      startIso = `${startIso}+02:00`;
      if (endIso) endIso = `${endIso}+02:00`;
    }
  }

  // 1. Limpiar/eliminar cualquier evento existente en la ventana 21:00 a 23:05 de ese día
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
          } catch (delErr) {
            console.warn(`No se pudo eliminar evento previo ${ev.id}:`, delErr);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Fallo en la limpieza previa de eventos conflictivos:", cleanErr);
    }
  }

  const eventRequestBody: any = {
    summary: newSummary,
    colorId: "9", // Color Azul (Blueberry) en Google Calendar
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 0 }, // Recordatorio al inicio del evento (0 minutos)
      ],
    },
  };

  // 2. Crear o actualizar el evento en Google Calendar
  if (startIso && endIso) {
    eventRequestBody.start = { dateTime: startIso };
    eventRequestBody.end = { dateTime: endIso };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventRequestBody,
    });
    return response.data;
  }

  const response = await calendar.events.patch({
    calendarId: "primary",
    eventId: slotId,
    requestBody: eventRequestBody,
  });

  return response.data;
}
