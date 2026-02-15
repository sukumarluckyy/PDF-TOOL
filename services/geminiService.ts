import { GoogleGenAI } from "@google/genai";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API_KEY is not defined in the environment");
    }
    return new GoogleGenAI({ apiKey });
};

export const analyzePDFContent = async (textContext: string, prompt: string) => {
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Here is the content of a PDF document (or a summary of it):
            
            ${textContext.substring(0, 10000)}... [truncated if too long]
            
            User Question: ${prompt}
            
            Please answer the question based on the document content.`,
             config: {
                systemInstruction: "You are a helpful PDF assistant. You analyze document content and help users understand their files.",
             }
        });
        return response.text;
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return "I encountered an error analyzing the document. Please check your API key.";
    }
};

export const suggestFileName = async (fileNames: string[]) => {
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `I am merging the following files: ${fileNames.join(', ')}. Suggest a short, professional name for the merged PDF file (ending in .pdf). Return ONLY the filename.`,
        });
        return response.text?.trim() || "merged-document.pdf";
    } catch (error) {
        return "merged-document.pdf";
    }
};
