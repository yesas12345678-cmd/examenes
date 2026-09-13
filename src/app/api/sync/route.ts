import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { groupConsecutiveSlots, syncSlotGroupInstance, createAllDayExamEvent } from "@/lib/googleCalendar";
import { SyncPayload, CalendarSlot, getRequiredHours } from "@/types";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { success: false, error: "Sesión no válida o token de Google faltante. Re-inicia sesión con Google." },
        { status: 401 }
      );
    }

    const body: SyncPayload = await request.json();
    const { exam, selectedSlotIds, allSlots } = body;

    // Validaciones básicas
    if (!exam || !exam.name || !exam.date) {
      return NextResponse.json(
        { success: false, error: "El nombre y la fecha del examen son obligatorios." },
        { status: 400 }
      );
    }

    if (!selectedSlotIds || selectedSlotIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Debes seleccionar al menos un bloque de tiempo en el calendario." },
        { status: 400 }
      );
    }

    // Comprobar requerimiento de slots según nivel de esfuerzo / horas elegidas
    const requiredSlots = getRequiredHours(exam.effortLevel);

    if (selectedSlotIds.length !== requiredSlots) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Has seleccionado ${selectedSlotIds.length} bloques, pero tu nivel de esfuerzo requiere exactamente ${requiredSlots} horas.` 
        },
        { status: 400 }
      );
    }

    // Obtener los objetos CalendarSlot correspondientes a los IDs seleccionados
    const selectedSlots: CalendarSlot[] = (allSlots || []).filter((s) => selectedSlotIds.includes(s.id));

    // Si algún slot no se encontró por ID, reconstruirlo sintéticamente
    if (selectedSlots.length < selectedSlotIds.length) {
      for (const id of selectedSlotIds) {
        if (!selectedSlots.some((s) => s.id === id)) {
          const match = id.match(/^virtual_(\d{2})(\d{2})_(\d{4}-\d{2}-\d{2})$/);
          if (match) {
            const [, sh, sm, dateStr] = match;
            const h = Number(sh);
            const m = Number(sm);
            const [year, month, day] = dateStr.split("-").map(Number);
            const pad = (num: number) => String(num).padStart(2, "0");
            const startIso = `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:00`;
            let endH = h + 1;
            let endM = m;
            if (h === 21 && m === 10) { endH = 22; endM = 0; }
            if (h === 1 && m === 30) { endH = 2; endM = 30; }
            const endIso = `${year}-${pad(month)}-${pad(day)}T${pad(endH)}:${pad(endM)}:00`;
            selectedSlots.push({
              id,
              summary: `Bloque`,
              start: startIso,
              end: endIso,
              isTimeBlock: true,
            });
          }
        }
      }
    }

    // Agrupar bloques consecutivos del mismo día en un único intervalo
    const groups = groupConsecutiveSlots(selectedSlots);

    // 1. Procesar la creación de grupos de estudio unificados en Google Calendar (Azul + Recordatorio 0m)
    const updatedCalendarEvents = [];
    const calendarErrors = [];

    for (const group of groups) {
      try {
        const result = await syncSlotGroupInstance(
          session.accessToken,
          group,
          exam.name
        );
        updatedCalendarEvents.push(result);
      } catch (err: any) {
        console.error(`Fallo actualizando grupo de bloques:`, err);
        calendarErrors.push(err.message || "Error en grupo de bloques");
      }
    }

    // 2. Crear evento de Todo el Día (All-Day) para el examen en el calendario 'examenes'
    let allDayExamResult = null;
    let allDayExamError = null;

    try {
      allDayExamResult = await createAllDayExamEvent(session.accessToken, exam);
    } catch (err: any) {
      console.error("Error al crear el evento de todo el día para el examen:", err);
      allDayExamError = err.message || "Error al registrar el examen en el calendario 'examenes'";
    }

    if (calendarErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Ocurrió un fallo al procesar los bloques en Google Calendar: ${calendarErrors.join(", ")}`,
        },
        { status: 500 }
      );
    }

    let message = `¡Genial! Se crearon ${updatedCalendarEvents.length} bloque(s) de estudio unificados en azul`;
    if (allDayExamResult) {
      message += ` y se registró el examen "Examen: ${exam.name}" de todo el día en tu calendario "examenes".`;
    } else if (allDayExamError) {
      message += `, pero hubo una advertencia al crear el evento de todo el día: ${allDayExamError}`;
    }

    return NextResponse.json({
      success: true,
      message,
      data: {
        updatedBlocksCount: updatedCalendarEvents.length,
        allDayExamResult,
      },
    });

  } catch (error: any) {
    console.error("Error crítico en /api/sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error interno del servidor al procesar la sincronización.",
      },
      { status: 500 }
    );
  }
}
