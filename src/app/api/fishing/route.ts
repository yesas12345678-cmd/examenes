import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scheduleFishingDay } from "@/lib/googleCalendar";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { success: false, error: "No autenticado o token de Google faltante. Re-inicia sesión con Google." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { date, startTime, endTime } = body;

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: "La fecha, hora de inicio y hora de fin son obligatorias." },
        { status: 400 }
      );
    }

    // Verificar que sea sábado o domingo
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    if (dayOfWeek !== 6 && dayOfWeek !== 0) {
      return NextResponse.json(
        { success: false, error: "La jornada de pesca solo puede programarse en Sábado o Domingo." },
        { status: 400 }
      );
    }

    const result = await scheduleFishingDay(
      session.accessToken,
      date,
      startTime,
      endTime
    );

    const dayName = dayOfWeek === 6 ? "Sábado" : "Domingo";
    const targetDayName = dayOfWeek === 6 ? "Domingo" : "Sábado";

    let message = `🎣 ¡Jornada de pesca programada para el ${dayName} ${date} (${startTime} - ${endTime})!`;
    if (result.movedCount > 0 || result.deletedCount > 0) {
      message += ` Tareas ajustadas: ${result.movedCount} pasada(s) al ${targetDayName}, ${result.deletedCount} eliminada(s) (getupp/artefactos a mano/Estudio: b2).`;
    }

    return NextResponse.json({
      success: true,
      message,
      data: result,
    });
  } catch (error: any) {
    console.error("Error en /api/fishing:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Ocurrió un error al procesar la jornada de pesca.",
      },
      { status: 500 }
    );
  }
}
