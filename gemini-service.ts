
import { GoogleGenAI } from "@google/genai";
import { Client, Task } from "./types";

// Always use a named parameter for the API key and obtain it from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSmartInsights = async (clients: Client[], tasks: Task[]) => {
  try {
    const prompt = `
      Actúa como un experto consultor contable senior. 
      Analiza la siguiente base de datos de un estudio contable y genera un resumen estratégico en español (máximo 300 palabras).
      
      Datos:
      - Total Clientes: ${clients.length}
      - Total Tareas este mes: ${tasks.length}
      - Distribución de impuestos: ${JSON.stringify(clients.map(c => c.taxConfig))}
      - Estado de tareas: ${JSON.stringify(tasks.map(t => t.status))}
      
      Por favor, indica:
      1. Cuellos de botella potenciales.
      2. Recomendaciones de eficiencia.
      3. Alertas sobre vencimientos o carga de trabajo excesiva para el personal.
      Usa un tono profesional y motivador.
    `;

    // Use ai.models.generateContent with the appropriate model name.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    // Directly access the .text property (it is not a method).
    return response.text;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "No se pudieron generar los insights en este momento.";
  }
};
