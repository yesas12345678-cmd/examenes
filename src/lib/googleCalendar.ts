import { google } from "googleapis";
import { CalendarSlot } from "@/types";

export function getGoogleCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Obtiene los eventos de los próximos X días.
 * 'singleEvents: true' expande las series recurrentes en instancias individuales.
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
    singleEvents: true, // Expande los eventos recurrentes en instancias individuales únicas
    orderBy: "startTime",
  });

  const items = response.data.items || [];

  return items.map((item) => {
    const summary = item.summary ? item.summary.trim() : "";
    
    // Consideramos bloque libre/disponible si no tiene título o contiene etiquetas comunes de timeblocking
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
    };
  });
}

/**
 * Actualiza SOLO la instancia específica del evento seleccionado (This Event / Instance Only)
 * Sin afectar a la serie recurrente original.
 */
export async function patchCalendarEventInstance(
  accessToken: string,
  instanceId: string,
  examName: string
): Promise<any> {
  const calendar = getGoogleCalendarClient(accessToken);
  const newSummary = `Estudio: ${examName}`;

  try {
    const response = await calendar.events.patch({
      calendarId: "primary",
      eventId: instanceId, // ID único de la instancia devuelta por singleEvents
      requestBody: {
        summary: newSummary,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(`Error actualizando instancia de Google Calendar (${instanceId}):`, error);
    throw new Error(
      error.message || `No se pudo actualizar el bloque de calendario ID ${instanceId}`
    );
  }
}
