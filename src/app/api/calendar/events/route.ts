import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUpcomingCalendarEvents } from "@/lib/googleCalendar";

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { success: false, error: "No autenticado o sesión expirada. Inicia sesión con Google." },
        { status: 401 }
      );
    }

    const events = await getUpcomingCalendarEvents(session.accessToken, 14);

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error: any) {
    console.error("Error en /api/calendar/events:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al obtener los eventos de Google Calendar",
      },
      { status: 500 }
    );
  }
}
