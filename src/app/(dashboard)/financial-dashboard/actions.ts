"use server"

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { revalidatePath } from "next/cache"
import pdfParse from 'pdf-parse'

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function processBankStatementAction(formData: FormData) {
    const companyId = await ensureAuth();
    if (!genAI) {
        return { success: false, error: "Gemini API key is missing." };
    }

    const file = formData.get("file") as File;
    if (!file) {
        return { success: false, error: "No file provided" };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString("base64");
        
        let mimeType = "text/plain";
        if (file.name.toLowerCase().endsWith('.pdf')) {
            mimeType = "application/pdf";
        } else if (file.name.toLowerCase().endsWith('.csv')) {
            mimeType = "text/csv";
        } else if (file.name.toLowerCase().endsWith('.xlsx')) {
            mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash", 
            generationConfig: { responseMimeType: "application/json" } 
        });

        const prompt = `You are an expert AI accounting assistant.
        I am providing you with a bank statement, expense report, or transaction list file.
        Please carefully extract all financial transactions from it.
        For each transaction, provide:
        - date: ISO format YYYY-MM-DD
        - description: clean and concise description of the vendor/transaction
        - amount: positive number (absolute value)
        - type: "INCOME" or "EXPENSE"
        - category: one of ["Salaries/Wages", "Materials", "Equipment", "Fuel/Transport", "Subcontractors", "Office/Admin", "Utilities", "Miscellaneous"]

        Analyze the document carefully. 
        Return the result as a JSON object with a key 'transactions' containing an array of these objects.
        If the file has no recognizable transactions, return {"transactions": []}.
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType } }
        ]);

        const textResponse = result.response.text();
        const parsed = JSON.parse(textResponse);
        const transactions = parsed.transactions || [];

        // Save to database
        const createdCount = await prisma.transaction.createMany({
            data: transactions.map((t: any) => ({
                companyId,
                date: new Date(t.date),
                description: t.description,
                amount: Math.abs(Number(t.amount) || 0),
                type: t.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
                category: t.category || 'Miscellaneous',
                source: 'Bank Upload'
            }))
        });

        revalidatePath('/financial-dashboard');
        return { success: true, count: createdCount.count };
    } catch (error: any) {
        console.error("Statement processing error:", error);
        return { success: false, error: error.message || "Failed to process statement" };
    }
}

export async function addManualTransactionAction(data: {
    date: string;
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    category: string;
}) {
    const companyId = await ensureAuth();
    
    await prisma.transaction.create({
        data: {
            companyId,
            date: new Date(data.date),
            description: data.description,
            amount: Math.abs(data.amount),
            type: data.type,
            category: data.category,
            source: 'Manual'
        }
    });

    revalidatePath('/financial-dashboard');
    return { success: true };
}
