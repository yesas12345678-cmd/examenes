import { Client } from "@notionhq/client";
import { ExamData } from "@/types";

export function getNotionClient() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("La variable de entorno NOTION_API_KEY no está configurada.");
  }
  return new Client({ auth: apiKey });
}

/**
 * Crea una nueva página en Notion adaptándose dinámicamente a la base de datos conectada.
 * Si el ID proporcionado es una Página en vez de una Base de Datos, busca automáticamente 
 * la base de datos contenida o accesible.
 */
export async function createExamNotionPage(exam: ExamData) {
  const notion = getNotionClient();
  let targetDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!targetDatabaseId) {
    throw new Error("La variable de entorno NOTION_DATABASE_ID no está configurada.");
  }

  // Quitar guiones u otros caracteres si los tuviera
  targetDatabaseId = targetDatabaseId.trim().replace(/-/g, "");

  let db: any = null;

  try {
    // 1. Intentar obtener la base de datos directamente por su ID
    db = await notion.databases.retrieve({ database_id: targetDatabaseId });
  } catch (err: any) {
    console.warn("Intento directo de base de datos falló, buscando bases de datos compartidas con la integración...", err.message);

    // Fallback: Si el ID ingresado era un ID de Página o falló, buscar las bases de datos accesibles
    try {
      const searchRes: any = await notion.search({
        filter: { value: "page", property: "object" },
      });

      if (searchRes.results && searchRes.results.length > 0) {
        // Buscar algún resultado que sea base de datos o usar el primero
        const dbResult = searchRes.results.find((item: any) => item.object === "database") || searchRes.results[0];
        db = dbResult;
        targetDatabaseId = dbResult.id;
      } else {
        throw new Error(
          `No se encontró ninguna Base de Datos. Recuerda hacer clic en '...' -> 'Connections' -> Añadir 'StudySync' en tu vista de tabla de Notion. Detalle: ${err.message}`
        );
      }
    } catch (searchErr: any) {
      throw new Error(
        `Error accediendo a Notion: ${err.message}. Asegúrate de conectar 'StudySync' en tu Notion.`
      );
    }
  }

  // 2. Detectar dinámicamente el esquema de columnas de la base de datos encontrada
  const propertiesSchema = db.properties || {};

  const titlePropKey = Object.keys(propertiesSchema).find(
    (key) => propertiesSchema[key].type === "title"
  );

  const datePropKey = Object.keys(propertiesSchema).find(
    (key) => propertiesSchema[key].type === "date"
  );

  const priorityPropKey = Object.keys(propertiesSchema).find(
    (key) =>
      key.toLowerCase().includes("prior") ||
      key.toLowerCase().includes("prio") ||
      key.toLowerCase() === "priority"
  );

  const typePropKey = Object.keys(propertiesSchema).find(
    (key) =>
      key.toLowerCase().includes("tipo") ||
      key.toLowerCase().includes("type") ||
      key.toLowerCase() === "tipo"
  );

  if (!titlePropKey) {
    throw new Error(
      `La base de datos de Notion no tiene ninguna columna de tipo Título (title). Columnas encontradas: ${Object.keys(propertiesSchema).join(", ")}`
    );
  }

  // 3. Construir el objeto de propiedades de la página
  const pageProperties: Record<string, any> = {
    [titlePropKey]: {
      title: [
        {
          text: {
            content: exam.name,
          },
        },
      ],
    },
  };

  if (datePropKey) {
    pageProperties[datePropKey] = {
      date: {
        start: exam.date,
      },
    };
  }

  if (priorityPropKey) {
    const type = propertiesSchema[priorityPropKey].type;
    if (type === "select") {
      pageProperties[priorityPropKey] = { select: { name: exam.priority } };
    } else if (type === "status") {
      pageProperties[priorityPropKey] = { status: { name: exam.priority } };
    }
  }

  if (typePropKey) {
    const type = propertiesSchema[typePropKey].type;
    if (type === "select") {
      pageProperties[typePropKey] = { select: { name: exam.type } };
    } else if (type === "status") {
      pageProperties[typePropKey] = { status: { name: exam.type } };
    }
  }

  // 4. Crear la nueva página en Notion
  const response = await notion.pages.create({
    parent: {
      database_id: targetDatabaseId!,
    },
    properties: pageProperties,
  });

  return response;
}
