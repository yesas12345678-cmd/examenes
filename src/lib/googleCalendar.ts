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
 * Comprueba si la descripción/resumen corresponde a 'pc o pesca' (excluyendo 'jornada de pesca').
 */
function isPcPescaSummary(summary: string | undefined | null): boolean {
  if (!summary) return false;
  const lower = summary.toLowerCase().trim();
  if (lower.includes("jornada de pesca")) return false; // NO coincidir con Jornadas de pesca
  return lower.includes("pc o pesca") || lower === "pc" || lower === "pesca" || lower.includes("pc/pesca");
}

/**
 * Garantiza que en la fecha dada (si es Sábado en tiempo de España) exista el evento "pc o pesca" de 01:00 a 01:30.
 */
export async function createOrEnsurePcPescaForDate(accessToken: string, targetInput: Date | string) {
  let dateObj: Date;
  if (typeof targetInput === "string") {
    if (!targetInput.includes("+") && !targetInput.includes("Z")) {
      const [dPart] = targetInput.split("T");
      const [y, m, d] = dPart.split("-").map(Number);
      dateObj = new Date(y, m - 1, d);
    } else {
      dateObj = new Date(targetInput);
    }
  } else {
    dateObj = targetInput;
  }

  // Obtener fecha en zona horaria Europe/Madrid
  const madridStr = dateObj.toLocaleString("en-US", { timeZone: "Europe/Madrid" });
  const madridDate = new Date(madridStr);

  if (madridDate.getDay() !== 6) return; // Solo sábados

  const year = madridDate.getFullYear();
  const month = madridDate.getMonth();
  const dateNum = madridDate.getDate();

  const start100Iso = createSpainIsoString(year, month, dateNum, 1, 0);
  const end130Iso = createSpainIsoString(year, month, dateNum, 1, 30);
  const queryMin = createSpainIsoString(year, month, dateNum, 0, 50);
  const queryMax = createSpainIsoString(year, month, dateNum, 2, 40);

  const calendar = getGoogleCalendarClient(accessToken);

  try {
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: queryMin,
      timeMax: queryMax,
      singleEvents: true,
    });

    const items = response.data.items || [];

    // Comprobar si ya existe un evento "pc o pesca" de 01:00 a 01:30
    const hasCorrectSlot = items.some((item) => {
      if (!isPcPescaSummary(item.summary)) return false;
      if (!item.start?.dateTime || !item.end?.dateTime) return false;
      const dS = new Date(item.start.dateTime);
      const dE = new Date(item.end.dateTime);
      const sM = new Date(dS.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
      const eM = new Date(dE.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
      return sM.getHours() === 1 && sM.getMinutes() === 0 && eM.getHours() === 1 && eM.getMinutes() === 30;
    });

    if (!hasCorrectSlot) {
      const existingPcPesca = items.find((item) => isPcPescaSummary(item.summary));

      if (existingPcPesca && existingPcPesca.id) {
        await calendar.events.patch({
          calendarId: "primary",
          eventId: existingPcPesca.id,
          requestBody: {
            summary: "pc o pesca",
            colorId: "10", // Color Verde (Basil) en Google Calendar
            reminders: {
              useDefault: false,
              overrides: [{ method: "popup", minutes: 0 }], // Recordatorio al inicio (0 min)
            },
            start: { dateTime: start100Iso },
            end: { dateTime: end130Iso },
          },
        });
        console.log(`Parcheado evento 'pc o pesca' a 01:00-01:30 en ${year}-${month + 1}-${dateNum}`);
      } else {
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: "pc o pesca",
            colorId: "10", // Color Verde (Basil) en Google Calendar
            reminders: {
              useDefault: false,
              overrides: [{ method: "popup", minutes: 0 }], // Recordatorio al inicio (0 min)
            },
            start: { dateTime: start100Iso },
            end: { dateTime: end130Iso },
          },
        });
        console.log(`Creado evento 'pc o pesca' (01:00-01:30) en ${year}-${month + 1}-${dateNum}`);
      }
    }
  } catch (err) {
    console.warn("Fallo creando/asegurando pc o pesca:", err);
  }
}

/**
 * Garantiza que en los sábados pasados y futuros exista el evento "pc o pesca" de 01:00 a 01:30.
 */
export async function ensureSaturdayPcPescaSlot(
  accessToken: string,
  daysAhead: number = 14
) {
  const now = new Date();
  for (let d = -7; d < daysAhead; d++) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const madridStr = dayDate.toLocaleString("en-US", { timeZone: "Europe/Madrid" });
    const madridDate = new Date(madridStr);
    if (madridDate.getDay() === 6) {
      await createOrEnsurePcPescaForDate(accessToken, dayDate);
    }
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

    // 2. Martes: Solo 16:00 - 17:00 (se eliminó 17:00 - 18:00)
    if (dayOfWeek === 2) {
      allowedHourRanges.push({ startH: 16, startM: 0, endH: 17, endM: 0 });
    }

    // 3. Jueves: 16:00 - 17:00 y 17:00 - 18:00
    if (dayOfWeek === 4) {
      allowedHourRanges.push({ startH: 16, startM: 0, endH: 17, endM: 0 });
      allowedHourRanges.push({ startH: 17, startM: 0, endH: 18, endM: 0 });
    }

    // 4. Sábado y Domingo: 10 a 15 (10-11, 11-12, 12-13, 13-14, 14-15) y 16 a 18 (16-17, 17-18)
    if ([6, 0].includes(dayOfWeek)) {
      allowedHourRanges.push({ startH: 10, startM: 0, endH: 11, endM: 0 });
      allowedHourRanges.push({ startH: 11, startM: 0, endH: 12, endM: 0 });
      allowedHourRanges.push({ startH: 12, startM: 0, endH: 13, endM: 0 });
      allowedHourRanges.push({ startH: 13, startM: 0, endH: 14, endM: 0 });
      allowedHourRanges.push({ startH: 14, startM: 0, endH: 15, endM: 0 });
      allowedHourRanges.push({ startH: 16, startM: 0, endH: 17, endM: 0 });
      allowedHourRanges.push({ startH: 17, startM: 0, endH: 18, endM: 0 });
    }

    // 5. Solo Sábado Madrugada: 01:30 a 02:30
    if (dayOfWeek === 6) {
      allowedHourRanges.push({ startH: 1, startM: 30, endH: 2, endM: 30, isNight: true });
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
        if (overlappingEv.isFishing) {
          slotSummary = overlappingEv.summary;
          isFishing = true;
          isTimeBlock = false;
        } else if (overlappingEv.isStudy) {
          slotSummary = overlappingEv.summary;
          isTimeBlock = true;
        } else {
          // Tarea previa sustituible (ej: "pc y tareas", "abuelos"): es libre para seleccionar
          slotSummary = defaultSummary;
          isTimeBlock = true;
          isOccupied = true;
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

export interface MergedSlotGroup {
  startIso: string;
  endIso: string;
  slotIds: string[];
}

/**
 * Agrupa slots consecutivos del mismo día para sincronizarlos en un único evento unificado en Google Calendar.
 */
export function groupConsecutiveSlots(slots: CalendarSlot[]): MergedSlotGroup[] {
  if (slots.length === 0) return [];

  // Ordenar por hora de inicio
  const sorted = [...slots].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const groups: MergedSlotGroup[] = [];
  let currentGroup: MergedSlotGroup = {
    startIso: sorted[0].start,
    endIso: sorted[0].end,
    slotIds: [sorted[0].id],
  };

  for (let i = 1; i < sorted.length; i++) {
    const prevEndMs = new Date(currentGroup.endIso).getTime();
    const nextStartMs = new Date(sorted[i].start).getTime();

    const diffMinutes = Math.abs((nextStartMs - prevEndMs) / (1000 * 60));
    const sameDay =
      new Date(currentGroup.startIso).toDateString() ===
      new Date(sorted[i].start).toDateString();

    if (sameDay && diffMinutes <= 5) {
      // Extender el grupo actual
      currentGroup.endIso = sorted[i].end;
      currentGroup.slotIds.push(sorted[i].id);
    } else {
      groups.push(currentGroup);
      currentGroup = {
        startIso: sorted[i].start,
        endIso: sorted[i].end,
        slotIds: [sorted[i].id],
      };
    }
  }
  groups.push(currentGroup);
  return groups;
}

/**
 * Procesa la sincronización de un grupo de bloques de estudio continuos en un solo evento en Google Calendar.
 */
export async function syncSlotGroupInstance(
  accessToken: string,
  group: MergedSlotGroup,
  examName: string
): Promise<any> {
  const calendar = getGoogleCalendarClient(accessToken);
  const newSummary = `Estudio: ${examName}`;

  let startIso = group.startIso;
  let endIso = group.endIso;

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

  // Limpieza previa de la franja unificada: Eliminar cualquier evento no-estudio previo en la ventana
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
            console.log(`Evento sustituido en la franja unificada: ${ev.summary} (${ev.id})`);
          } catch (delErr) {
            console.warn(`No se pudo eliminar evento previo ${ev.id}:`, delErr);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Fallo en la limpieza previa de franja unificada:", cleanErr);
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

  // Asegurar que 'pc o pesca' exista de 01:00 a 01:30 solo en el sábado correspondiente
  if (startIso) {
    await createOrEnsurePcPescaForDate(accessToken, startIso);
  }

  return response.data;
}

/**
 * Procesa la sincronización de un bloque de estudio individual (fallback).
 */
export async function syncSlotInstance(
  accessToken: string,
  slotId: string,
  examName: string,
  allSlots: CalendarSlot[] = []
): Promise<any> {
  const targetSlot = allSlots.find((s) => s.id === slotId);
  if (targetSlot) {
    return syncSlotGroupInstance(
      accessToken,
      { startIso: targetSlot.start, endIso: targetSlot.end, slotIds: [slotId] },
      examName
    );
  }
  return null;
}

/**
 * Determina si un evento es un bloque de time blocking vacío o genérico (ej: "10:00-11:00", "Bloque Libre", etc.)
 */
function isEmptyTimeBlock(summary: string | undefined | null): boolean {
  if (!summary || !summary.trim()) return true;
  const s = summary.trim();
  const lower = s.toLowerCase();

  if (lower.startsWith("bloque libre") || lower.startsWith("bloque noche")) return true;

  // Coincide con rangos horarios tipo "10:00-11:00", "10:00 - 11:00", "10:00 – 11:00"
  const timeRangeRegex = /^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/;
  if (timeRangeRegex.test(s)) return true;

  return false;
}

/**
 * Programar Jornada de Pesca para Sábados o Domingos.
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

  const deletedTaskKeywords = ["getupp", "artefactos a mano"];

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

      // 1. Si es un bloque de time blocking vacío o genérico (ej: "10:00-11:00" o "Bloque Libre")
      // NO se pospone/atrasa al otro día. Simplemente lo eliminamos del día de pesca.
      if (isEmptyTimeBlock(summaryTrim)) {
        try {
          await calendar.events.delete({
            calendarId: "primary",
            eventId: ev.id,
          });
        } catch (delEmptyErr) {
          console.warn(`Error limpiando bloque vacío en pesca ${ev.id}:`, delEmptyErr);
        }
        continue;
      }

      // 2. Si es una tarea a eliminar directamente
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
        // 3. Tarea real del usuario (ej: "hola")
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

        // Antes de mover la tarea al día destino, comprobar si en esa franja del día destino hay bloques vacíos
        try {
          const targetStartMs = new Date(newStartIso).getTime();
          const targetEndMs = new Date(newEndIso).getTime();
          const targetQueryMin = new Date(targetStartMs - 60 * 1000).toISOString();
          const targetQueryMax = new Date(targetEndMs + 60 * 1000).toISOString();

          const targetEvents = await calendar.events.list({
            calendarId: "primary",
            timeMin: targetQueryMin,
            timeMax: targetQueryMax,
            singleEvents: true,
          });

          const targetItems = targetEvents.data.items || [];
          for (const tEv of targetItems) {
            if (!tEv.id) continue;
            const tEvStartIso = tEv.start?.dateTime;
            const tEvEndIso = tEv.end?.dateTime;
            if (tEvStartIso && tEvEndIso) {
              const tEvStartMs = new Date(tEvStartIso).getTime();
              const tEvEndMs = new Date(tEvEndIso).getTime();
              const tOverlaps = tEvStartMs < targetEndMs && tEvEndMs > targetStartMs;
              if (tOverlaps && isEmptyTimeBlock(tEv.summary)) {
                // Eliminar el bloque vacío en el día destino para que la tarea ocupe la franja sin superponerse
                try {
                  await calendar.events.delete({
                    calendarId: "primary",
                    eventId: tEv.id,
                  });
                  console.log(`Eliminado bloque de time blocking vacío en destino: ${tEv.summary}`);
                } catch (delTargetErr) {
                  console.warn("No se pudo eliminar bloque vacío en destino:", delTargetErr);
                }
              }
            }
          }
        } catch (targetCheckErr) {
          console.warn("Error comprobando eventos en día destino:", targetCheckErr);
        }

        // Mover la tarea al día de destino
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

  // Crear Evento Timed con el color por defecto del calendario y notificación al inicio
  const timedEvent = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: "Jornada de Pesca",
      start: { dateTime: fishingStartIso },
      end: { dateTime: fishingEndIso },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 0 }],
      },
    },
  });

  // Crear Evento All-Day con el color por defecto del calendario "jornada de pesca Hstart-Hend"
  const startHInt = parseInt(startH.toString(), 10);
  const endHInt = parseInt(endH.toString(), 10);
  const allDaySummary = `jornada de pesca ${startHInt}-${endHInt}`;

  const allDayEvent = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: allDaySummary,
      start: { date: dateStr },
      end: { date: dateStr },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 0 }],
      },
    },
  });

  // Asegurar que 'pc o pesca' se mantenga de 01:00 a 01:30 únicamente en la fecha de pesca si es sábado
  await createOrEnsurePcPescaForDate(accessToken, fishingDate);

  return {
    timedEvent: timedEvent.data,
    allDayEvent: allDayEvent.data,
    movedCount: movedEventsList.length,
    deletedCount: deletedEventsList.length,
    movedEvents: movedEventsList,
    deletedEvents: deletedEventsList,
  };
}
