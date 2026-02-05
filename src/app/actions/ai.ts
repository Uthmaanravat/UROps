'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"
import { prisma } from "@/lib/prisma"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function transcribeAudio(formData: FormData) {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("Using mock transcription due to missing Gemini API key");
        return { success: true, text: "I need to fix the roof and install three new air conditioning units in the building." }
    }

    const file = formData.get("file") as File
    if (!file) {
        throw new Error("No file provided")
    }

    try {
        console.log("Transcribing file:", {
            name: file.name,
            type: file.type,
            size: file.size
        });

        const arrayBuffer = await file.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: file.type || "audio/mp3",
                    data: base64Audio
                }
            },
            { text: "Transcribe this audio file accurately." }
        ]);

        const text = result.response.text();
        return { success: true, text }
    } catch (error: any) {
        console.error("Transcription error details:", error)

        // Handle Quota/429 for Gemini
        if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
            console.warn("Gemini Quota Exceeded. Using mock transcription.");
            return { success: true, text: "I need to fix the roof and install three new air conditioning units in the building." }
        }

        const errorMessage = error.message || "Failed to transcribe audio";
        return { success: false, error: errorMessage }
    }
}

export async function getPricingSuggestions(items: { description: string }[]) {
    const suggestions: Record<string, { typicalPrice: number; source: string }> = {};

    for (const item of items) {
        // 1. Check PricingKnowledge (exact or partial match)
        const knowledge = await prisma.pricingKnowledge.findFirst({
            where: {
                description: {
                    contains: item.description,
                    mode: 'insensitive'
                }
            },
            orderBy: { frequency: 'desc' }
        });

        if (knowledge) {
            suggestions[item.description] = {
                typicalPrice: knowledge.typicalPrice,
                source: 'Knowledge Base'
            };
            continue;
        }

        // 2. Check previous InvoiceItem history
        const historicalItem = await prisma.invoiceItem.findFirst({
            where: {
                description: {
                    contains: item.description,
                    mode: 'insensitive'
                },
                unitPrice: { gt: 0 }
            },
            orderBy: { invoice: { date: 'desc' } }
        });

        if (historicalItem) {
            suggestions[item.description] = {
                typicalPrice: historicalItem.unitPrice,
                source: 'Historical Data'
            };
        }
    }

    return suggestions;
}

export async function parseScopeOfWork(text: string) {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("Using mock parsing due to missing Gemini API key");
        return {
            success: true,
            items: [
                { description: "Roof repair and flashing fix", quantity: 1, unit: "Lot", unitPrice: 5000 },
                { description: "Install new AC units", quantity: 3, unit: "Unit", unitPrice: 12000 }
            ]
        }
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `You are an expert project manager for a maintenance and construction company. 
        Your task is to take a transcribed voice note and parse it into a structured Scope of Work (SOW).
        Identify individual tasks, descriptions, and any mentioned quantities or materials.
        Return the result as a JSON object with a key 'items' which is an array of objects with 'description', 'quantity', and 'unitPrice' (if mentioned, otherwise 0).
        
        Voice Note: ${text}`;

        const result = await model.generateContent(prompt);
        const textResponse = result.response.text();

        const parsed = JSON.parse(textResponse);
        return { success: true, items: parsed.items || parsed.tasks || [] }
    } catch (error: any) {
        console.error("Parsing error:", error)

        if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
            console.warn("Gemini Quota Exceeded. Using mock parsing.");
            return {
                success: true,
                items: [
                    { description: "Roof repair and flashing fix (Mock)", quantity: 1, unit: "Lot", unitPrice: 5000 },
                    { description: "Install new AC units (Mock)", quantity: 3, unit: "Unit", unitPrice: 12000 }
                ]
            }
        }

        return { success: false, error: "Failed to parse scope of work" }
    }
}

export async function extractPricingFromText(text: string) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing Gemini API Key")
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `You are a specialized data extractor for construction and maintenance quotations.
        Your goal is to extract EVERY SINGLE individual line item and their typical unit prices.
        Do not skip any items. If a quotation has 20 items, extract all 20.
        Ignore headers, total sums, and tax lines. Focus on the actual work components.
        For each item, identify:
        1. Description (clean and concise)
        2. Typical unit price (as a number)
        3. Unit of measure (e.g. m2, hr, ea, Lot)
        Return the result as a JSON object with a key 'items' containing an array of these objects.
        
        Text content: ${text}`;

        const result = await model.generateContent(prompt);
        const textResponse = result.response.text();

        const parsed = JSON.parse(textResponse);
        return parsed.items || []
    } catch (error: any) {
        console.error("CRITICAL AI EXTRACTION ERROR:", error)
        console.error("Error keys:", Object.keys(error))
        console.error("Error message:", error.message)
        console.error("Error status:", error.status)

        if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
            console.warn("GEMINI FALLBACK TRIGGERED - Using mock extraction.");
            return [
                { description: "Test Item (Gemini Quota Exceeded)", typicalPrice: 1500, unit: "Item" },
                { description: "Another Test Item", typicalPrice: 450, unit: "m2" },
                { description: "Labor/Service Charge", typicalPrice: 850, unit: "hr" }
            ];
        }

        throw error
    }
}
