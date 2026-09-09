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

  // Mapear eventos existentes en la cuenta para detectar horas ocupadas o jornadas de pesca
  const existingEventsList: { startMs: number; endMs: number; summary: string; isStudy: boolean; isFishing: boolean }[] = [];
  for (const item of items) {
    const summary = item.summary ? item.summary.trim() : "";
    const evStartStr = item.start?.dateTime;
    const evEndStr = item.end?.dateTime;

    if (evStartStr && evEndStr) {
      const startMs = new Date(evStartStr).getTime();
      const endMs = new Date(evEndStr).getTime();
      const summaryLower = summary.toLowerCase();
      existingEventsList.push({
        startMs,
        endMs,
        summary,
        isStudy: summary.startsWith("Estudio:"),
        isFishing: summaryLower.includes("jornada de pesca"),
      });
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

    // 1. Bloques Nocturnos (Lunes, Martes, Miércoles, Jueves)
    if ([1, 2, 3, 4].includes(dayOfWeek)) {
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

    // Ordenar cronológicamente dentro del día
    allowedHourRanges.sort((a, b) => a.startH * 60 + a.startM - (b.startH * 60 + b.startM));

    for (const range of allowedHourRanges) {
      const slotStartNaive = createNaiveLocalIsoString(year, month, dateNum, range.startH, range.startM);
      const slotEndNaive = createNaiveLocalIsoString(year, month, dateNum, range.endH, range.endM);

      const padSH = String(range.startH).padStart(2, "0");
      const padSM = String(range.startM).padStart(2, "0");
      const padEH = String(range.endH).padStart(2, "0");
      const padEM = String(range.endM).padStart(2, "0");

      const slotStartMs = new Date(createSpainIsoString(year, month, dateNum, range.startH, range.startM)).getTime();
      const slotEndMs = new Date(createSpainIsoString(year, month, dateNum, range.endH, range.endM)).getTime();

      // Buscar si algún evento en la cuenta se solapa con este bloque
      const overlappingEv = existingEventsList.find(
        (ev) => ev.startMs < slotEndMs && ev.endMs > slotStartMs
      );

      const defaultSummary = range.isNight
        ? `Bloque Noche (${padSH}:${padSM} - ${padEH}:${padEM})`
        : `Bloque Libre (${padSH}:${padSM} - ${padEH}:${padEM})`;

      let slotSummary = defaultSummary;
      let isTimeBlock = true;
      let isFishing = false;
      let isOccupied = false;

      if (overlappingEv) {
        slotSummary = overlappingEv.summary;
        if (overlappingEv.isStudy) {
          isTimeBlock = true;
        } else if (overlappingEv.isFishing) {
          isFishing = true;
          isTimeBlock = false;
        } else {
          isOccupied = true;
          isTimeBlock = false;
        }
      }

      resultSlots.push({
        id: `virtual_${padSH}${padSM}_${dateStr}`,
        summary: slotSummary,
        start: slotStartNaive,
        end: slotEndNaive,
        isTimeBlock,
        isVirtual: true,
        isDefaultNightSlot: range.isNight || false,
        isFishing,
        isOccupied,
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

  // Limpieza previa de sustitución: Eliminar cualquier evento previo en la franja seleccionada
  if (startIso && endIso) {
    try {
      const targetWindowStart = new Date(startIso).getTime();
      const targetWindowEnd = new Date(endIso).getTime();

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

/**
 * Programar Jornada de Pesca para Sábados o Domingos.
 * - Si es Sábado: Las tareas en esa franja se posponen al Domingo (mismo horario).
 * - Si es Domingo: Las tareas en esa franja se atrasan al Sábado (mismo horario).
 * - Tareas a eliminar automáticamente: "getupp", "artefactos a mano", "Estudio: b2" (case-insensitive).
 * - Crea evento Timed en Rojo (colorId: '11') con notificación al inicio.
 * - Crea evento All-Day en Rojo (colorId: '11') "jornada de pesca Hstart-Hend".
 */
export async function scheduleFishingDay(
  accessToken: string,
  dateStr: string, // YYYY-MM-DD
  startTime: string, // HH:mm (ej: "08:00")
  endTime: string // HH:mm (ej: "13:00")
) {
  const calendar = getGoogleCalendarClient(accessToken);
  const [year, month, day] = dateStr.split("-").map(Number);
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const fishingDate = new Date(year, month - 1, day);
  const dayOfWeek = fishingDate.getDay(); // 6 = Sábado, 0 = Domingo

  if (dayOfWeek !== 6 && dayOfWeek !== 0) {
    throw new Error("La jornada de pesca solo se puede programar en Sábado o Domingo.");
  }

  // Determinar el día de destino para posponer / atrasar
  const targetDate = new Date(fishingDate);
  if (dayOfWeek === 6) {
    targetDate.setDate(targetDate.getDate() + 1); // Sábado -> Domingo
  } else {
    targetDate.setDate(targetDate.getDate() - 1); // Domingo -> Sábado
  }

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDayNum = targetDate.getDate();

  // Strings ISO de inicio y fin para la pesca
  const fishingStartIso = createSpainIsoString(year, month - 1, day, startH, startM);
  const fishingEndIso = createSpainIsoString(year, month - 1, day, endH, endM);

  const fishingStartMs = new Date(fishingStartIso).getTime();
  const fishingEndMs = new Date(fishingEndIso).getTime();

  // Consultar eventos en la franja
  const queryMin = new Date(fishingStartMs - 60 * 1000).toISOString();
  const queryMax = new Date(fishingEndMs + 60 * 1000).toISOString();

  const listResponse = await calendar.events.list({
    calendarId: "primary",
    timeMin: queryMin,
    timeMax: queryMax,
    singleEvents: true,
  });

  const items = listResponse.data.items || [];

  const deletedTaskKeywords = ["getupp", "artefactos a mano", "estudio: b2"];

  const movedEventsList: string[] = [];
  const deletedEventsList: string[] = [];

  for (const ev of items) {
    if (!ev.id) continue;
    const summaryTrim = (ev.summary || "").trim();
    if (summaryTrim.toLowerCase().includes("jornada de pesca")) continue;

    const evStartStr = ev.start?.dateTime;
    const evEndStr = ev.end?.dateTime;

    if (evStartStr && evEndStr) {
      const evStartMs = new Date(evStartStr).getTime();
      const evEndMs = new Date(evEndStr).getTime();

      const overlaps = evStartMs < fishingEndMs && evEndMs > fishingStartMs;
      if (!overlaps) continue;

      const summaryLower = summaryTrim.toLowerCase();

      const shouldDelete = deletedTaskKeywords.some((kw) => summaryLower.includes(kw));

      if (shouldDelete) {
        try {
          await calendar.events.delete({
            calendarId: "primary",
            eventId: ev.id,
          });
          deletedEventsList.push(summaryTrim || "Tarea eliminada");
        } catch (delErr) {
          console.warn(`Error eliminando evento ${ev.id}:`, delErr);
        }
      } else {
        // Extraer horas y minutos locales del evento original
        let evSH = 0, evSM = 0, evEH = 0, evEM = 0;
        if (evStartStr.includes("T")) {
          const [, tPart] = evStartStr.split("T");
          const [h, m] = tPart.split(":").map(Number);
          evSH = h;
          evSM = m;
        } else {
          const d = new Date(evStartStr);
          evSH = d.getHours();
          evSM = d.getMinutes();
        }

        if (evEndStr.includes("T")) {
          const [, tPart] = evEndStr.split("T");
          const [h, m] = tPart.split(":").map(Number);
          evEH = h;
          evEM = m;
        } else {
          const d = new Date(evEndStr);
          evEH = d.getHours();
          evEM = d.getMinutes();
        }

        const newStartIso = createSpainIsoString(targetYear, targetMonth, targetDayNum, evSH, evSM);
        const newEndIso = createSpainIsoString(targetYear, targetMonth, targetDayNum, evEH, evEM);

        try {
          await calendar.events.patch({
            calendarId: "primary",
            eventId: ev.id,
            requestBody: {
              start: { dateTime: newStartIso },
              end: { dateTime: newEndIso },
            },
          });
          movedEventsList.push(summaryTrim || "Tarea movida");
        } catch (patchErr) {
          console.warn(`Error moviendo evento ${ev.id}:`, patchErr);
        }
      }
    }
  }

  // Crear Evento Timed en Rojo (colorId: "11") con notificación al inicio
  const timedEvent = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: "Jornada de Pesca",
      colorId: "11",
      start: { dateTime: fishingStartIso },
      end: { dateTime: fishingEndIso },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 0 }],
      },
    },
  });

  // Crear Evento All-Day en Rojo (colorId: "11") "jornada de pesca Hstart-Hend"
  const startHInt = parseInt(startH.toString(), 10);
  const endHInt = parseInt(endH.toString(), 10);
  const allDaySummary = `jornada de pesca ${startHInt}-${endHInt}`;

  const allDayEvent = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: allDaySummary,
      colorId: "11",
      start: { date: dateStr },
      end: { date: dateStr },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 0 }],
      },
    },
  });

  return {
    timedEvent: timedEvent.data,
    allDayEvent: allDayEvent.data,
    movedCount: movedEventsList.length,
    deletedCount: deletedEventsList.length,
    movedEvents: movedEventsList,
    deletedEvents: deletedEventsList,
  };
}
