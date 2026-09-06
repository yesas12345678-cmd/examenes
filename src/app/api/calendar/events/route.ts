import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUpcomingCalendarEvents } from "@/lib/googleCalendar";

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { success: false, error: "No autenticado o sesión expirada. Por favor, cierra sesión y vuelve a iniciar sesión con Google." },
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
    
    const isAuthError =
      error.message?.includes("invalid authentication credentials") ||
      error.message?.includes("Invalid Credentials") ||
      error.status === 401;

    const friendlyError = isAuthError
      ? "Tu sesión de Google expiró. Por favor, haz clic en el botón de cerrar sesión (arriba a la derecha) y vuelve a conectar tu cuenta de Google."
      : error.message || "Error al obtener los eventos de Google Calendar";

    return NextResponse.json(
      {
        success: false,
        error: friendlyError,
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
