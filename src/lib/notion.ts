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
 * Incluye fallback automático si las opciones de Select (High, Exam) no existen aún en Notion.
 */
export async function createExamNotionPage(exam: ExamData) {
  const notion = getNotionClient();
  let targetDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!targetDatabaseId) {
    throw new Error("La variable de entorno NOTION_DATABASE_ID no está configurada.");
  }

  targetDatabaseId = targetDatabaseId.trim().replace(/-/g, "");

  let db: any = null;

  try {
    db = await notion.databases.retrieve({ database_id: targetDatabaseId });
  } catch (err: any) {
    throw new Error(`Error obteniendo la base de datos de Notion (${targetDatabaseId}): ${err.message}`);
  }

  const propertiesSchema = db.properties || {};
  const allKeys = Object.keys(propertiesSchema);

  // 1. Buscar la columna de tipo 'title'
  let titlePropKey = allKeys.find(
    (key) => propertiesSchema[key]?.type === "title"
  );

  if (!titlePropKey) {
    titlePropKey = allKeys.find(
      (key) =>
        key.toLowerCase() === "name" ||
        key.toLowerCase() === "nombre" ||
        key.toLowerCase() === "title" ||
        key.toLowerCase() === "tarea"
    ) || allKeys[0] || "Name";
  }

  // 2. Buscar la columna de tipo 'date'
  let datePropKey = allKeys.find(
    (key) => propertiesSchema[key]?.type === "date"
  );

  // 3. Buscar columna de prioridad
  let priorityPropKey = allKeys.find(
    (key) =>
      key.toLowerCase().includes("prior") ||
      key.toLowerCase().includes("prio") ||
      key.toLowerCase() === "priority"
  );

  // 4. Buscar columna de tipo
  let typePropKey = allKeys.find(
    (key) =>
      key.toLowerCase().includes("tipo") ||
      key.toLowerCase().includes("type") ||
      key.toLowerCase() === "tipo"
  );

  // Construir objeto de propiedades principal
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

  if (priorityPropKey && propertiesSchema[priorityPropKey]) {
    const propType = propertiesSchema[priorityPropKey].type;
    if (propType === "select") {
      pageProperties[priorityPropKey] = { select: { name: exam.priority } };
    } else if (propType === "status") {
      pageProperties[priorityPropKey] = { status: { name: exam.priority } };
    }
  }

  if (typePropKey && propertiesSchema[typePropKey]) {
    const propType = propertiesSchema[typePropKey].type;
    if (propType === "select") {
      pageProperties[typePropKey] = { select: { name: exam.type } };
    } else if (propType === "status") {
      pageProperties[typePropKey] = { status: { name: exam.type } };
    }
  }

  try {
    // Intentar crear la página con todas las propiedades detectadas
    const response = await notion.pages.create({
      parent: {
        database_id: targetDatabaseId,
      },
      properties: pageProperties,
    });
    return response;
  } catch (createErr: any) {
    console.warn("Intento completo falló, aplicando fallback seguro de Título y Fecha:", createErr.message);

    // Fallback de ultra seguridad: Crear la página solo con Título y Fecha (evita fallos por selects inexistentes)
    const fallbackProperties: Record<string, any> = {
      [titlePropKey]: {
        title: [{ text: { content: exam.name } }],
      },
    };

    if (datePropKey) {
      fallbackProperties[datePropKey] = { date: { start: exam.date } };
    }

    const fallbackResponse = await notion.pages.create({
      parent: {
        database_id: targetDatabaseId,
      },
      properties: fallbackProperties,
    });

    return fallbackResponse;
  }
}
