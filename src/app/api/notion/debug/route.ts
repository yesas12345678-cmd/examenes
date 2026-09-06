import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

export async function GET() {
  try {
    const notion = getNotionClient();
    const configuredDbId = process.env.NOTION_DATABASE_ID;

    let configuredDbDetails = null;
    let configuredDbError = null;

    if (configuredDbId) {
      const cleanId = configuredDbId.trim().replace(/-/g, "");
      try {
        const db: any = await notion.databases.retrieve({ database_id: cleanId });
        configuredDbDetails = {
          id: db.id,
          title: db.title?.[0]?.plain_text || "Sin título",
          rawPropertiesKeys: Object.keys(db.properties || {}),
          rawProperties: db.properties,
        };
      } catch (err: any) {
        configuredDbError = err.message || "No se pudo obtener la base de datos con ese ID.";
      }
    }

    return NextResponse.json({
      success: true,
      configuredEnvDatabaseId: configuredDbId,
      configuredDbDetails,
      configuredDbError,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al conectar con Notion SDK.",
      },
      { status: 500 }
    );
  }
}
