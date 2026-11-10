'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"
import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import OpenAI from "openai"
import { generateContentWithFallback } from "@/lib/ai"

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function transcribeAudio(formData: FormData) {
    if (!genAI) {
        return { success: false, error: "Gemini API key is missing." }
    }

    const file = formData.get("file") as File
    if (!file) {
        throw new Error("No file provided")
    }

    const totalStartTime = Date.now();
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const attemptStartTime = Date.now();
        try {
            console.log(`Transcribing file with Gemini (Attempt ${attempt + 1}/${maxRetries + 1}):`, {
                name: file.name,
                size: file.size,
                type: file.type
            });

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Default to audio/webm if type is missing or not fully specified
            let mimeType = file.type || "audio/webm";
            if (!mimeType.includes('/')) mimeType = "audio/" + mimeType;

            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const result = await model.generateContent([
                "You are a professional transcription assistant. Please accurately transcribe the following audio. Return ONLY the transcribed text without any conversational filler, markdown formatting, or surrounding quotes.",
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: buffer.toString("base64")
                    }
                }
            ]);

            const duration = Date.now() - attemptStartTime;
            console.log(`Transcription successful in ${duration}ms (Attempt ${attempt + 1})`);

            return { success: true, text: result.response.text() }
        } catch (error: any) {
            lastError = error;
            const duration = Date.now() - attemptStartTime;
            console.error(`Attempt ${attempt + 1} failed after ${duration}ms:`, error.message);

            const isNetworkError = error.code === 'ECONNRESET' || error.message?.includes('ECONNRESET');

            if (!isNetworkError || attempt === maxRetries) {
                break;
            }

            // Wait with exponential backoff
            const waitTime = 1000 * Math.pow(2, attempt);
            console.log(`Retrying in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }

    const totalDuration = Date.now() - totalStartTime;
    console.error(`All transcription attempts failed after ${totalDuration}ms`);

    return { success: false, error: lastError?.message || "Failed to transcribe audio" }
}

export async function getPricingSuggestions(items: { description: string }[]) {
    const companyId = await ensureAuth();
    const suggestions: Record<string, { typicalPrice: number; source: string; minPrice?: number; maxPrice?: number }> = {};

    const wanted = items
        .map(i => ({ original: i.description, desc: i.description?.trim() || "" }))
        .filter(i => i.desc.length >= 2);
    if (wanted.length === 0) return suggestions;

    // PERFORMANCE: previously this ran up to 4 sequential queries PER line item
    // (336 round trips for an 84-line quote). Server actions are queued one at a
    // time per browser tab, so a slow suggestions call blocked "Save Changes" and
    // caused the 25s save timeout on large quotes. We now load the 3 lookup sources
    // once (3 parallel queries) and match in memory, preserving the same precedence:
    // 1) Standard catalog  2) Pricing knowledge (contains, then keyword)  3) Historical items.
    const [catalogItems, knowledgeAll, historicalItems] = await Promise.all([
        prisma.fixedPriceItem.findMany({
            where: { companyId, unitPrice: { gt: 0 } },
            select: { description: true, unitPrice: true }
        }),
        prisma.pricingKnowledge.findMany({
            where: { companyId },
            orderBy: { frequency: 'desc' },
            select: { description: true, typicalPrice: true, minPrice: true, maxPrice: true }
        }),
        prisma.invoiceItem.findMany({
            where: { invoice: { companyId }, unitPrice: { gt: 0 } },
            orderBy: { invoice: { createdAt: 'desc' } },
            select: { description: true, unitPrice: true, reason: true },
            take: 5000
        })
    ]);

    const catalogLower = catalogItems.map(c => ({ ...c, lower: (c.description || "").toLowerCase() }));
    const knowledgeLower = knowledgeAll.map(k => ({ ...k, lower: (k.description || "").toLowerCase() }));
    const topKnowledge = knowledgeLower.slice(0, 100);
    const historicalLower = historicalItems.map(h => ({ ...h, lower: (h.description || "").toLowerCase() }));

    for (const { original, desc } of wanted) {
        const descLower = desc.toLowerCase();

        // 1. Standard Catalog (description ILIKE %desc%)
        const catalogItem = catalogLower.find(c => c.lower.includes(descLower));
        if (catalogItem) {
            suggestions[original] = { typicalPrice: catalogItem.unitPrice, source: 'Standard Catalog' };
            continue;
        }

        // 2. PricingKnowledge direct/partial match (highest frequency first)
        const knowledge = knowledgeLower.find(k => k.lower.includes(descLower));
        if (knowledge) {
            suggestions[original] = {
                typicalPrice: knowledge.typicalPrice,
                minPrice: knowledge.minPrice,
                maxPrice: knowledge.maxPrice,
                source: 'Pricing Intelligence'
            };
            continue;
        }

        // 2b. PricingKnowledge bidirectional / keyword match over top 100 by frequency
        const words = descLower.split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
            let bestK: any = null;
            let bestScore = 0;
            for (const k of topKnowledge) {
                if (k.lower.includes(descLower) || descLower.includes(k.lower)) {
                    bestK = k;
                    break;
                }
                const matches = words.filter(w => k.lower.includes(w)).length;
                if (matches > bestScore && matches >= 1) {
                    bestScore = matches;
                    bestK = k;
                }
            }
            if (bestK) {
                suggestions[original] = {
                    typicalPrice: bestK.typicalPrice,
                    minPrice: bestK.minPrice,
                    maxPrice: bestK.maxPrice,
                    source: 'Pricing Intelligence'
                };
                continue;
            }
        }

        // 3. Previous InvoiceItem history (most recent invoice first)
        const historicalItem = historicalLower.find(h => h.lower.includes(descLower));
        if (historicalItem && historicalItem.unitPrice) {
            suggestions[original] = {
                typicalPrice: historicalItem.unitPrice,
                source: historicalItem.reason ? `Historical (${historicalItem.reason})` : 'Historical Quotes'
            };
        }
    }

    return suggestions;
}

export async function parseScopeOfWork(text: string) {
    try {
        if (!genAI) {
            return { success: false, error: "Gemini API Key is missing. AI parsing unavailable." }
        }

        const prompt = `You are an expert project manager for a maintenance and construction company. 
        Your task is to take a transcribed voice note and parse it into a structured Scope of Work (SOW).
        Identify individual tasks, descriptions, and any mentioned quantities or materials.
        Return the result as a JSON object with a key 'items' which is an array of objects with 'description', 'quantity', and 'unitPrice' (if mentioned, otherwise 0).
        
        Voice Note: ${text}`;

        const result = await generateContentWithFallback(genAI, prompt, { responseMimeType: "application/json" });
        const textResponse = result.response.text();

        const parsed = JSON.parse(textResponse);
        return { success: true, items: parsed.items || parsed.tasks || [] }
    } catch (error: any) {
        console.error("Parsing error:", error)

        if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
            console.warn("Gemini Quota Exceeded.");
            return {
                success: false,
                error: "AI limit reached. Please try manually splitting items."
            }
        }

        return { success: false, error: "Failed to parse scope of work" }
    }
}

export async function extractPricingFromText(text: string) {
    if (!genAI) {
        throw new Error("Missing Gemini API Key")
    }

    try {
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

        const result = await generateContentWithFallback(genAI, prompt, { responseMimeType: "application/json" });
        const textResponse = result.response.text();

        const parsed = JSON.parse(textResponse);
        return parsed.items || []
    } catch (error: any) {
        console.error("CRITICAL AI EXTRACTION ERROR:", error)
        console.error("Error keys:", Object.keys(error))
        console.error("Error message:", error.message)
        console.error("Error status:", error.status)

        if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
            console.warn("GEMINI FALLBACK TRIGGERED - No mock available.");
            throw new Error("AI extraction limit reached. Please try again later.")
        }

        throw error
    }
}
