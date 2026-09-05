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
 * Crea una nueva página en Notion adaptándose dinámicamente a las columnas
 * reales que tenga la base de datos del usuario (Nombre, Fecha, Prioridad, Tipo, etc.)
 */
export async function createExamNotionPage(exam: ExamData) {
  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!databaseId) {
    throw new Error("La variable de entorno NOTION_DATABASE_ID no está configurada.");
  }

  try {
    // 1. Obtener la estructura real de columnas de la Base de Datos en Notion
    const db: any = await notion.databases.retrieve({ database_id: databaseId });
    const propertiesSchema = db.properties;

    // 2. Detectar automáticamente las columnas por su tipo o nombre aproximado
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
      throw new Error("No se encontró ninguna columna de tipo Título (title) en tu base de datos de Notion.");
    }

    // 3. Construir el objeto de propiedades de forma dinámica y segura
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

    // Asignar fecha si la columna existe en Notion
    if (datePropKey) {
      pageProperties[datePropKey] = {
        date: {
          start: exam.date,
        },
      };
    }

    // Asignar prioridad si la columna existe y es de tipo select o status
    if (priorityPropKey) {
      const type = propertiesSchema[priorityPropKey].type;
      if (type === "select") {
        pageProperties[priorityPropKey] = { select: { name: exam.priority } };
      } else if (type === "status") {
        pageProperties[priorityPropKey] = { status: { name: exam.priority } };
      }
    }

    // Asignar tipo si la columna existe y es de tipo select o status
    if (typePropKey) {
      const type = propertiesSchema[typePropKey].type;
      if (type === "select") {
        pageProperties[typePropKey] = { select: { name: exam.type } };
      } else if (type === "status") {
        pageProperties[typePropKey] = { status: { name: exam.type } };
      }
    }

    // 4. Crear la página en Notion con la estructura adaptada
    const response = await notion.pages.create({
      parent: {
        database_id: databaseId,
      },
      properties: pageProperties,
    });

    return response;
  } catch (error: any) {
    console.error("Error al crear la entrada en Notion:", error);
    throw new Error(
      error.body?.message || error.message || "Fallo en la comunicación con Notion API"
    );
  }
}
