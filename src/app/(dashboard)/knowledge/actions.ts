'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { extractPricingFromText } from "@/app/actions/ai"
import path from "path"

export async function uploadQuotationAction(formData: FormData) {
    const file = formData.get('file') as File
    if (!file) throw new Error("No file selected")

    let text = ""
    try {
        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
            console.log("Analyzing PDF:", file.name, "Size:", file.size);
            const buffer = Buffer.from(await file.arrayBuffer())
            console.log("Buffer size:", buffer.length);

            // Correctly use pdf-parse which exports a function, not a class
            // @ts-ignore
            let pdfParse = require("pdf-parse");

            // Handle potential ESM/CJS interop issues
            if (typeof pdfParse !== 'function' && pdfParse.default) {
                pdfParse = pdfParse.default;
            }

            if (typeof pdfParse !== 'function') {
                console.error("pdf-parse import is not a function. Type:", typeof pdfParse, "Value keys:", Object.keys(pdfParse));
                throw new Error("PDF parser library failed to initialize. Please restart the application.");
            }

            console.log("Parsing PDF buffer...");
            const result = await pdfParse(buffer);
            text = result.text;
            console.log("Extracted text length:", text?.length);
        } else {
            text = await file.text()
        }

        if (!text || text.trim().length === 0) {
            console.error("Text extraction failed for file:", file.name);
            throw new Error("Could not extract text from file")
        }

        console.log("Sending text to AI for pricing extraction...");
        const extractedItems = await extractPricingFromText(text)
        console.log("AI extracted items count:", extractedItems?.length);

        if (!extractedItems || extractedItems.length === 0) {
            console.warn("AI returned no items for file:", file.name);
            return { success: false, error: "AI could not find any line items in this document." }
        }

        let learnedCount = 0;

        for (const item of extractedItems) {
            if (!item.description || !item.typicalPrice) {
                console.log("Skipping invalid item:", item);
                continue
            }

            // Upsert logic for PricingKnowledge
            const existing = await prisma.pricingKnowledge.findFirst({
                where: {
                    description: {
                        equals: item.description,
                        mode: 'insensitive'
                    }
                }
            })

            if (existing) {
                console.log("Updating existing knowledge for:", item.description);
                await prisma.pricingKnowledge.update({
                    where: { id: existing.id },
                    data: {
                        frequency: existing.frequency + 1,
                        minPrice: Math.min(existing.minPrice, item.typicalPrice),
                        maxPrice: Math.max(existing.maxPrice, item.typicalPrice),
                        typicalPrice: (existing.typicalPrice * existing.frequency + item.typicalPrice) / (existing.frequency + 1)
                    }
                })
            } else {
                console.log("Creating new knowledge for:", item.description);
                await prisma.pricingKnowledge.create({
                    data: {
                        description: item.description,
                        typicalPrice: item.typicalPrice,
                        minPrice: item.typicalPrice * 0.9,
                        maxPrice: item.typicalPrice * 1.1,
                        frequency: 1,
                        source: file.name
                    }
                })
            }
            learnedCount++;
        }

        revalidatePath("/knowledge")
        return { success: true, learnedCount }
    } catch (error) {
        console.error("Knowledge Upload Error:", error);
        return { success: false, error: String(error) }
    }
}

export async function deletePricingKnowledgeAction(id: string) {
    try {
        console.log("Deleting pricing knowledge:", id);
        await prisma.pricingKnowledge.delete({
            where: { id }
        })
        revalidatePath("/knowledge")
        return { success: true }
    } catch (error) {
        console.error("Error deleting pricing knowledge:", error);
        return { success: false, error: String(error) }
    }
}
