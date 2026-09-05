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
 * Crea una nueva página en la base de datos de Notion con las propiedades del Examen.
 * Propiedades estándar esperadas en la DB de Notion:
 * - Title / Nombre (title)
 * - Date / Fecha (date)
 * - Priority / Prioridad (select)
 * - Type / Tipo (select)
 */
export async function createExamNotionPage(exam: ExamData) {
  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!databaseId) {
    throw new Error("La variable de entorno NOTION_DATABASE_ID no está configurada.");
  }

  try {
    // Intentamos mapear con los nombres de propiedad especificados en los requisitos
    const response = await notion.pages.create({
      parent: {
        database_id: databaseId,
      },
      properties: {
        // Título del examen
        Title: {
          title: [
            {
              text: {
                content: exam.name,
              },
            },
          ],
        },
        // Fecha del examen
        Date: {
          date: {
            start: exam.date,
          },
        },
        // Prioridad ("High", "Medium", "Low")
        Priority: {
          select: {
            name: exam.priority,
          },
        },
        // Tipo ("Exam", "Quiz", etc.)
        Type: {
          select: {
            name: exam.type,
          },
        },
      },
    });

    return response;
  } catch (error: any) {
    console.error("Error al crear la entrada en Notion:", error);
    // Si la base de datos usa nombres en español como "Nombre" o "Fecha", intentamos un fallback inteligente
    if (error.code === "validation_error" && error.message?.includes("is not a property")) {
      try {
        const fallbackResponse = await notion.pages.create({
          parent: { database_id: databaseId },
          properties: {
            Nombre: {
              title: [{ text: { content: exam.name } }],
            },
            Fecha: {
              date: { start: exam.date },
            },
            Prioridad: {
              select: { name: exam.priority },
            },
            Tipo: {
              select: { name: exam.type },
            },
          },
        });
        return fallbackResponse;
      } catch (fallbackError: any) {
        throw new Error(
          `Error en propiedades de Notion: Asegúrate de que las columnas 'Title' (o 'Nombre'), 'Date' (o 'Fecha'), 'Priority' y 'Type' existan en tu base de datos.`
        );
      }
    }
    throw new Error(
      error.body?.message || error.message || "Fallo en la comunicación con Notion API"
    );
  }
}
