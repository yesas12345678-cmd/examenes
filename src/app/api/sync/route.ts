import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { patchCalendarEventInstance } from "@/lib/googleCalendar";
import { createExamNotionPage } from "@/lib/notion";
import { SyncPayload } from "@/types";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { success: false, error: "Sesión no válida o token de Google faltante. Re-inicia sesión." },
        { status: 401 }
      );
    }

    const body: SyncPayload = await request.json();
    const { exam, selectedSlotIds } = body;

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

    // Comprobar requerimiento de slots según esfuerzo
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

    // A. Actualizar Instancias específicas en Google Calendar
    const updatedCalendarEvents = [];
    const calendarErrors = [];

    for (const instanceId of selectedSlotIds) {
      try {
        const result = await patchCalendarEventInstance(
          session.accessToken,
          instanceId,
          exam.name
        );
        updatedCalendarEvents.push(result);
      } catch (err: any) {
        console.error(`Fallo actualizando bloque ID ${instanceId}:`, err);
        calendarErrors.push(err.message || instanceId);
      }
    }

    // B. Crear entrada en Notion
    let notionPageResult = null;
    let notionError = null;

    try {
      notionPageResult = await createExamNotionPage(exam);
    } catch (err: any) {
      console.error("Fallo al crear página en Notion:", err);
      notionError = err.message || "Error al sincronizar con Notion";
    }

    // Consolidación de respuesta
    if (calendarErrors.length > 0 && notionError) {
      return NextResponse.json(
        {
          success: false,
          error: `Falló la actualización tanto en Google Calendar como en Notion. Detalle Calendar: ${calendarErrors.join(", ")}. Detalle Notion: ${notionError}`,
        },
        { status: 500 }
      );
    }

    if (calendarErrors.length > 0) {
      return NextResponse.json(
        {
          success: true,
          partialError: true,
          message: `Notion creado con éxito, pero ${calendarErrors.length} de los bloques de Google Calendar fallaron.`,
          data: { updatedCalendarEvents, notionPageResult, calendarErrors },
        },
        { status: 207 }
      );
    }

    if (notionError) {
      return NextResponse.json(
        {
          success: true,
          partialError: true,
          message: `Google Calendar actualizado con éxito (${updatedCalendarEvents.length} bloques), pero ocurrió un error en Notion: ${notionError}`,
          data: { updatedCalendarEvents, notionPageResult: null, notionError },
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "¡Examen y tiempo de estudio sincronizados correctamente en Google Calendar y Notion!",
      data: {
        updatedBlocksCount: updatedCalendarEvents.length,
        notionPageId: notionPageResult?.id,
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
