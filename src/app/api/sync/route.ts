import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncSlotInstance } from "@/lib/googleCalendar";
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

    // Procesar la creación/actualización de bloques en Google Calendar
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

    if (calendarErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Ocurrió un fallo al procesar los bloques en Google Calendar: ${calendarErrors.join(", ")}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `¡Genial! Se han reservado ${updatedCalendarEvents.length} bloques de estudio en tu Google Calendar como "Estudio: ${exam.name}".`,
      data: {
        updatedBlocksCount: updatedCalendarEvents.length,
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
