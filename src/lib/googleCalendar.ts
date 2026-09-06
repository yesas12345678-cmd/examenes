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
          date: exam.date,
        },
        end: {
          date: exam.date,
        },
        colorId: "11", // Color Rojo (Tomato)
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 540 },
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
 * - Detecta eventos con títulos de rango horario (ej: "09:00 - 10:00", "16:00 - 17:00") como bloques libres.
 * - Genera bloques virtuales para huecos diurnos vacíos entre las 08:00 y las 21:00.
 * - Inyecta las sesiones fijas de 21:10 - 22:00 y 22:00 - 23:00 para Lun, Mar, Mié, Jue y Dom.
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

  const mappedEvents: CalendarSlot[] = [];

  for (const item of items) {
    const summary = item.summary ? item.summary.trim() : "";
    const lowerSummary = summary.toLowerCase();

    // Regex para detectar títulos de rango horario como "09:00 - 10:00", "09:00-10:00", "16:00 - 17:00", etc.
    const isTimePattern = /^\d{1,2}:\d{2}\s*(?:-|a)\s*\d{1,2}:\d{2}$/i.test(summary);

    // Un evento es un bloque libre de Google Calendar SOLO si:
    // 1. Su título es exactamente un rango horario (ej: "09:00 - 10:00")
    // 2. O su título es explícitamente "libre", "disponible", "timeblock", "" o "(sin título)"
    // 3. O su color en Google Calendar es verde (colorId "10" o "2")
    const isExplicitFreeKeyword =
      summary === "" ||
      lowerSummary === "timeblock" ||
      lowerSummary === "time block" ||
      lowerSummary === "libre" ||
      lowerSummary === "disponible" ||
      lowerSummary === "bloque libre" ||
      lowerSummary === "(sin título)" ||
      lowerSummary === "no title";

    const isGreenColor = item.colorId === "10" || item.colorId === "2";

    const isTimeBlock = isTimePattern || isExplicitFreeKeyword || isGreenColor;

    if (!isTimeBlock) {
      // Excluir estrictamente eventos ocupados (pc, lecture, come, gym, abuelos, gf, Instituto, etc.)
      continue;
    }

    let startStr = item.start?.dateTime || item.start?.date || "";
    let endStr = item.end?.dateTime || item.end?.date || "";

    if (startStr.includes("T")) {
      const dStart = new Date(startStr);
      startStr = createNaiveLocalIsoString(
        dStart.getFullYear(),
        dStart.getMonth(),
        dStart.getDate(),
        dStart.getHours(),
        dStart.getMinutes()
      );
    }

    if (endStr.includes("T")) {
      const dEnd = new Date(endStr);
      endStr = createNaiveLocalIsoString(
        dEnd.getFullYear(),
        dEnd.getMonth(),
        dEnd.getDate(),
        dEnd.getHours(),
        dEnd.getMinutes()
      );
    }

    mappedEvents.push({
      id: item.id || "",
      summary: summary || "Bloque Libre",
      start: startStr,
      end: endStr,
      recurringEventId: item.recurringEventId || undefined,
      isTimeBlock: true,
      isVirtual: false,
    });
  }

  // Inyectar ÚNICAMENTE las 2 sesiones nocturnas fijas solicitadas (21:10 - 22:00 y 22:00 - 23:00 en Dom, Lun, Mar, Mié, Jue)
  const allowedNightDays = [0, 1, 2, 3, 4]; // Dom, Lun, Mar, Mié, Jue
  const virtualSlots: CalendarSlot[] = [];

  for (let d = 0; d < daysAhead; d++) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const dayOfWeek = dayDate.getDay();

    if (allowedNightDays.includes(dayOfWeek)) {
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
        existing2110.summary = "Bloque Noche (21:10 - 22:00)";
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
        existing2200.summary = "Bloque Noche (22:00 - 23:00)";
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
 * - Elimina únicamente eventos estrictamente DENTRO de las 21:10 a 23:00 de ese día si es bloque nocturno.
 * - Reemplaza eventos de rango horario (ej: "09:00 - 10:00") o crea nuevos con el color Azul (colorId: "9").
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

  // Convertir strings Naive Local a ISO de España con offset (+02:00)
  if (startIso && !startIso.includes("+") && !startIso.includes("Z")) {
    const [dPart, tPart] = startIso.split("T");
    const [year, month, day] = dPart.split("-").map(Number);
    const [hours, minutes] = tPart.split(":").map(Number);
    startIso = createSpainIsoString(year, month - 1, day, hours, minutes);
  }

  if (endIso && !endIso.includes("+") && !endIso.includes("Z")) {
    const [dPart, tPart] = endIso.split("T");
    const [year, month, day] = dPart.split("-").map(Number);
    const [hours, minutes] = tPart.split(":").map(Number);
    endIso = createSpainIsoString(year, month - 1, day, hours, minutes);
  }

  // Limpieza previa estricta solo para franja nocturna 21:10-23:00
  if (startIso && endIso && startIso.includes("T21:10")) {
    try {
      const slotStartDate = new Date(startIso);
      const windowStart = createSpainIsoString(
        slotStartDate.getFullYear(),
        slotStartDate.getMonth(),
        slotStartDate.getDate(),
        21,
        10
      );
      const windowEnd = createSpainIsoString(
        slotStartDate.getFullYear(),
        slotStartDate.getMonth(),
        slotStartDate.getDate(),
        23,
        0
      );

      const existingInWindow = await calendar.events.list({
        calendarId: "primary",
        timeMin: windowStart,
        timeMax: windowEnd,
        singleEvents: true,
      });

      const eventsToDelete = existingInWindow.data.items || [];
      const targetWindowStart = new Date(windowStart);
      const targetWindowEnd = new Date(windowEnd);

      for (const ev of eventsToDelete) {
        if (!ev.id || ev.summary?.startsWith("Estudio:")) continue;

        const evStartIso = ev.start?.dateTime || ev.start?.date;
        const evEndIso = ev.end?.dateTime || ev.end?.date;
        if (!evStartIso || !evEndIso) continue;

        const evStart = new Date(evStartIso);
        const evEnd = new Date(evEndIso);

        const startsInside = evStart.getTime() >= targetWindowStart.getTime() - 2 * 60 * 1000;
        const endsInside = evEnd.getTime() <= targetWindowEnd.getTime() + 2 * 60 * 1000;

        if (startsInside && endsInside) {
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
      console.warn("Fallo en la limpieza previa nocturna:", cleanErr);
    }
  }

  const eventRequestBody: any = {
    summary: newSummary,
    colorId: "9", // Color Azul (Blueberry) en Google Calendar
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 0 },
      ],
    },
  };

  if (slotId.startsWith("virtual_")) {
    eventRequestBody.start = { dateTime: startIso };
    eventRequestBody.end = { dateTime: endIso };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventRequestBody,
    });
    return response.data;
  }

  eventRequestBody.start = { dateTime: startIso };
  eventRequestBody.end = { dateTime: endIso };

  const response = await calendar.events.patch({
    calendarId: "primary",
    eventId: slotId,
    requestBody: eventRequestBody,
  });

  return response.data;
}

