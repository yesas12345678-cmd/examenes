import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion";

export async function GET() {
  try {
    const notion = getNotionClient();
    const configuredDbId = process.env.NOTION_DATABASE_ID;

    // 1. Buscar todas las bases de datos a las que tiene acceso la integración 'StudySync'
    const searchResult = await notion.search({
      filter: { value: "database", property: "object" },
    });

    const accessibleDatabases = searchResult.results.map((db: any) => ({
      id: db.id,
      cleanId: db.id.replace(/-/g, ""),
      title: db.title?.[0]?.plain_text || "Sin título",
      properties: Object.keys(db.properties || {}).map((propKey) => ({
        name: propKey,
        type: db.properties[propKey].type,
      })),
      url: db.url,
    }));

    // 2. Intentar probar el ID configurado en .env
    let configuredDbDetails = null;
    let configuredDbError = null;

    if (configuredDbId) {
      const cleanId = configuredDbId.trim().replace(/-/g, "");
      try {
        const db: any = await notion.databases.retrieve({ database_id: cleanId });
        configuredDbDetails = {
          id: db.id,
          cleanId: db.id.replace(/-/g, ""),
          title: db.title?.[0]?.plain_text || "Sin título",
          properties: Object.keys(db.properties || {}).map((propKey) => ({
            name: propKey,
            type: db.properties[propKey].type,
          })),
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
      accessibleDatabasesCount: accessibleDatabases.length,
      accessibleDatabases,
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
