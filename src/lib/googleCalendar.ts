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
 * Obtiene los eventos de los próximos X días según los rangos estrictos permitidos por el usuario.
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

  // Mapear eventos de estudio ya agendados para preservar su nombre ("Estudio: Examen X")
  const existingStudyEvents: { start: string; end: string; summary: string }[] = [];
  for (const item of items) {
    const summary = item.summary ? item.summary.trim() : "";
    if (summary.startsWith("Estudio:")) {
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
      existingStudyEvents.push({ start: startStr, end: endStr, summary });
    }
  }

  const resultSlots: CalendarSlot[] = [];

  for (let d = 0; d < daysAhead; d++) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const dayOfWeek = dayDate.getDay(); // 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado
    const year = dayDate.getFullYear();
    const month = dayDate.getMonth();
    const dateNum = dayDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;

    // Lista de rangos de hora estrictamente permitidos según la especificación del usuario
    const allowedHourRanges: { startH: number; startM: number; endH: number; endM: number; isNight?: boolean }[] = [];

    // 1. Bloques Nocturnos (Domingo, Lunes, Martes, Miércoles, Jueves)
    if ([0, 1, 2, 3, 4].includes(dayOfWeek)) {
      allowedHourRanges.push({ startH: 21, startM: 10, endH: 22, endM: 0, isNight: true });
      allowedHourRanges.push({ startH: 22, startM: 0, endH: 23, endM: 0, isNight: true });
    }

    // 2. Martes y Jueves: 16:00 - 17:00 y 17:00 - 18:00
    if ([2, 4].includes(dayOfWeek)) {
      allowedHourRanges.push({ startH: 16, startM: 0, endH: 17, endM: 0 });
      allowedHourRanges.push({ startH: 17, startM: 0, endH: 18, endM: 0 });
    }

    // 3. Sábado y Domingo: 10 a 15 (10-11, 11-12, 12-13, 13-14, 14-15) y 16 a 18 (16-17, 17-18)
    if ([6, 0].includes(dayOfWeek)) {
      allowedHourRanges.push({ startH: 10, startM: 0, endH: 11, endM: 0 });
      allowedHourRanges.push({ startH: 11, startM: 0, endH: 12, endM: 0 });
      allowedHourRanges.push({ startH: 12, startM: 0, endH: 13, endM: 0 });
      allowedHourRanges.push({ startH: 13, startM: 0, endH: 14, endM: 0 });
      allowedHourRanges.push({ startH: 14, startM: 0, endH: 15, endM: 0 });
      allowedHourRanges.push({ startH: 16, startM: 0, endH: 17, endM: 0 });
      allowedHourRanges.push({ startH: 17, startM: 0, endH: 18, endM: 0 });
    }

    // 4. Solo Domingo: 18 a 19 y 19 a 20
    if (dayOfWeek === 0) {
      allowedHourRanges.push({ startH: 18, startM: 0, endH: 19, endM: 0 });
      allowedHourRanges.push({ startH: 19, startM: 0, endH: 20, endM: 0 });
    }

    // Ordenar cronológicamente dentro del día
    allowedHourRanges.sort((a, b) => a.startH * 60 + a.startM - (b.startH * 60 + b.startM));

    for (const range of allowedHourRanges) {
      const slotStartNaive = createNaiveLocalIsoString(year, month, dateNum, range.startH, range.startM);
      const slotEndNaive = createNaiveLocalIsoString(year, month, dateNum, range.endH, range.endM);

      const padSH = String(range.startH).padStart(2, "0");
      const padSM = String(range.startM).padStart(2, "0");
      const padEH = String(range.endH).padStart(2, "0");
      const padEM = String(range.endM).padStart(2, "0");

      const existingStudy = existingStudyEvents.find((e) => e.start === slotStartNaive);

      const defaultSummary = range.isNight
        ? `Bloque Noche (${padSH}:${padSM} - ${padEH}:${padEM})`
        : `Bloque Libre (${padSH}:${padSM} - ${padEH}:${padEM})`;

      resultSlots.push({
        id: `virtual_${padSH}${padSM}_${dateStr}`,
        summary: existingStudy ? existingStudy.summary : defaultSummary,
        start: slotStartNaive,
        end: slotEndNaive,
        isTimeBlock: true,
        isVirtual: true,
        isDefaultNightSlot: range.isNight || false,
      });
    }
  }

  return resultSlots;
}

/**
 * Procesa la sincronización de un bloque de estudio.
 * - Elimina cualquier evento previo en Google Calendar dentro de la franja seleccionada (sustitución de franja).
 * - Aplica el color Azul (colorId: "9") y recordatorio en el minuto 0.
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

  // Fallback si no está el targetSlot en allSlots
  if (!startIso || !endIso) {
    const match = slotId.match(/^virtual_(\d{2})(\d{2})_(\d{4}-\d{2}-\d{2})$/);
    if (match) {
      const [, sh, sm, dateStr] = match;
      const h = Number(sh);
      const m = Number(sm);
      const [year, month, day] = dateStr.split("-").map(Number);
      startIso = createNaiveLocalIsoString(year, month - 1, day, h, m);
      let endH = h + 1;
      let endM = m;
      if (h === 21 && m === 10) {
        endH = 22;
        endM = 0;
      }
      endIso = createNaiveLocalIsoString(year, month - 1, day, endH, endM);
    }
  }

  // Extraer día de la semana y horas/minutos locales para comprobar si es sustituible
  let dayOfWeek = -1;
  let hours = -1;
  let minutes = -1;

  if (startIso) {
    const [dPart, tPart] = startIso.split("T");
    if (dPart && tPart) {
      const [year, month, day] = dPart.split("-").map(Number);
      const [h, m] = tPart.split(":").map(Number);
      const d = new Date(year, month - 1, day);
      dayOfWeek = d.getDay();
      hours = h;
      minutes = m;
    }
  }

  const isNightSlot =
    !!targetSlot?.isDefaultNightSlot ||
    ([0, 1, 2, 3, 4].includes(dayOfWeek) &&
      ((hours === 21 && minutes === 10) || hours === 22));

  const isTuesdayOrThursdayAfternoonSlot =
    [2, 4].includes(dayOfWeek) && (hours === 16 || hours === 17);

  const allowSubstitution = isNightSlot || isTuesdayOrThursdayAfternoonSlot;

  // Convertir strings Naive Local a ISO de España con offset (+02:00)
  if (startIso && !startIso.includes("+") && !startIso.includes("Z")) {
    const [dPart, tPart] = startIso.split("T");
    const [year, month, day] = dPart.split("-").map(Number);
    const [h, m] = tPart.split(":").map(Number);
    startIso = createSpainIsoString(year, month - 1, day, h, m);
  }

  if (endIso && !endIso.includes("+") && !endIso.includes("Z")) {
    const [dPart, tPart] = endIso.split("T");
    const [year, month, day] = dPart.split("-").map(Number);
    const [h, m] = tPart.split(":").map(Number);
    endIso = createSpainIsoString(year, month - 1, day, h, m);
  }

  // Limpieza previa de sustitución SOLO para bloques de noche o Martes/Jueves tarde (16:00-18:00)
  if (allowSubstitution && startIso && endIso) {
    try {
      const targetWindowStart = new Date(startIso).getTime();
      const targetWindowEnd = new Date(endIso).getTime();

      // Ampliar 1 minuto la consulta a la API para capturar eventos que tocan los bordes
      const queryTimeMin = new Date(targetWindowStart - 60 * 1000).toISOString();
      const queryTimeMax = new Date(targetWindowEnd + 60 * 1000).toISOString();

      const existingInWindow = await calendar.events.list({
        calendarId: "primary",
        timeMin: queryTimeMin,
        timeMax: queryTimeMax,
        singleEvents: true,
      });

      const eventsToDelete = existingInWindow.data.items || [];

      for (const ev of eventsToDelete) {
        if (!ev.id || ev.summary?.startsWith("Estudio:")) continue;

        const evStartIso = ev.start?.dateTime;
        const evEndIso = ev.end?.dateTime;
        if (!evStartIso || !evEndIso) continue;

        const evStartMs = new Date(evStartIso).getTime();
        const evEndMs = new Date(evEndIso).getTime();

        // Detectar cualquier solapamiento: evStart < targetWindowEnd && evEnd > targetWindowStart
        const overlaps = evStartMs < targetWindowEnd && evEndMs > targetWindowStart;

        if (overlaps) {
          try {
            await calendar.events.delete({
              calendarId: "primary",
              eventId: ev.id,
            });
            console.log(`Evento sustituido en la franja: ${ev.summary} (${ev.id})`);
          } catch (delErr) {
            console.warn(`No se pudo eliminar evento previo ${ev.id}:`, delErr);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Fallo en la limpieza previa de franja:", cleanErr);
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
    start: { dateTime: startIso },
    end: { dateTime: endIso },
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventRequestBody,
  });

  return response.data;
}

