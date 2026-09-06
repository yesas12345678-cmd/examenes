import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncSlotInstance, createAllDayExamEvent } from "@/lib/googleCalendar";
import { SyncPayload } from "@/types";

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

    // Comprobar requerimiento de slots según nivel de esfuerzo
    const requiredSlotsMap = {
      '1_day': 2,
      '2_days': 4,
      '3_days': 6,
    };
    const requiredSlots = requiredSlotsMap[exam.effortLevel] || 2;

    if (selectedSlotIds.length !== requiredSlots) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Has seleccionado ${selectedSlotIds.length} bloques, pero tu nivel de esfuerzo requiere exactamente ${requiredSlots} bloques (${requiredSlots / 2} sesiones de 2h).` 
        },
        { status: 400 }
      );
    }

    // 1. Procesar la creación/actualización de bloques de estudio en Google Calendar (Azul + Recordatorio 0m)
    const updatedCalendarEvents = [];
    const calendarErrors = [];

    for (const instanceId of selectedSlotIds) {
      try {
        const result = await syncSlotInstance(
          session.accessToken,
          instanceId,
          exam.name,
          allSlots || []
        );
        updatedCalendarEvents.push(result);
      } catch (err: any) {
        console.error(`Fallo actualizando bloque ID ${instanceId}:`, err);
        calendarErrors.push(err.message || instanceId);
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

    let message = `¡Genial! Se reservaron ${updatedCalendarEvents.length} bloques de estudio en azul`;
    if (allDayExamResult) {
      message += ` y se creó el examen "Examen: ${exam.name}" de todo el día en tu calendario "examenes".`;
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
