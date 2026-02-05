import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function parseScopeToItems(scopeText: string) {
    // Mock mode if no valid API key
    if (!process.env.GEMINI_API_KEY) {
        console.log("Using Mock AI (No API Key provided)");
        return [
            { description: "Labor and installation (Est.)", quantity: 1, unitPrice: 850.00 },
            { description: "Materials and consumables", quantity: 1, unitPrice: 450.00 },
            { description: "Safety compliance check", quantity: 1, unitPrice: 150.00 }
        ];
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `You are a professional estimator for a building maintenance company.

Your task is to analyze a scope of work and break it down into billable line items.

IMPORTANT: You must respond with ONLY a valid JSON array. No other text, no markdown code blocks, just the raw JSON array.

Each item in the array must have exactly these keys:
- description: string (clear, professional description of the work item)
- quantity: number (count of units, default to 1 if unclear)
- unitPrice: number (estimated price in ZAR/Rand, be realistic for South African market)

Scope of Work:
${scopeText}`;

        const result = await model.generateContent(prompt);
        const content = result.response.text();
        console.log("AI Response:", content);

        if (content) {
            // Try to parse directly first
            try {
                const parsed = JSON.parse(content.trim());
                if (Array.isArray(parsed)) {
                    return parsed;
                } else if (parsed.items && Array.isArray(parsed.items)) {
                    // Handle case where Gemini wraps it in an object despite instructions
                    return parsed.items;
                }
            } catch {
                console.warn("Direct JSON parse failed, returning fallback");
            }
        }

        // If AI didn't return valid JSON, return helpful fallback
        console.log("AI returned non-JSON response, falling back to basic items");
        return [
            { description: scopeText.slice(0, 100) + (scopeText.length > 100 ? "..." : ""), quantity: 1, unitPrice: 0 }
        ];

    } catch (error: any) {
        console.error("AI Error:", error?.message || error);

        // Handle Quota/429 for Gemini
        if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
            console.warn("Gemini Quota Exceeded. Using mock items.");
            return [
                { description: "Labor and installation (Est. - Quota Exceeded)", quantity: 1, unitPrice: 850.00 },
                { description: "Materials and consumables (Mock)", quantity: 1, unitPrice: 450.00 }
            ];
        }

        // Return a single item with the scope text so user can manually price it
        return [
            { description: "Quote for: " + scopeText.slice(0, 80), quantity: 1, unitPrice: 0 }
        ];
    }
}
