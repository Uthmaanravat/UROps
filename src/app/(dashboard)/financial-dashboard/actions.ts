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

    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { settings: true }
    });
    const businessName = company?.settings?.name || company?.name || "the business";

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileName = file.name.toLowerCase();
        
        let textContent = "";
        let fileExtension = fileName.split('.').pop() || "";

        if (fileExtension === 'csv' || fileExtension === 'txt') {
            textContent = buffer.toString('utf-8');
        } else if (fileExtension === 'xlsx') {
            try {
                const ExcelJS = require('exceljs');
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                let excelText = "";
                workbook.eachSheet((worksheet: any) => {
                    excelText += `Sheet: ${worksheet.name}\n`;
                    worksheet.eachRow((row: any) => {
                        const rowValues: string[] = [];
                        row.eachCell((cell: any) => {
                            rowValues.push(cell.text || cell.value?.toString() || "");
                        });
                        excelText += rowValues.join(", ") + "\n";
                    });
                });
                textContent = excelText;
            } catch (err: any) {
                console.error("Excel parsing failed:", err);
                return { success: false, error: "Failed to parse Excel spreadsheet: " + err.message };
            }
        } else if (fileExtension === 'pdf') {
            try {
                let pdfParse = require("pdf-parse");
                if (typeof pdfParse !== 'function' && pdfParse.default) {
                    pdfParse = pdfParse.default;
                }
                if (typeof pdfParse !== 'function') {
                    throw new Error("pdf-parse is not a function");
                }
                const pdfData = await pdfParse(buffer);
                textContent = pdfData.text;
            } catch (pdfError) {
                console.error("Local PDF parsing failed, falling back to Gemini document parser:", pdfError);
            }
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest", 
            generationConfig: { responseMimeType: "application/json" } 
        });

        const prompt = `You are an expert AI accounting assistant.
        I am providing you with a bank statement, expense report, or transaction list file for a business named "${businessName}".
        Please carefully extract all financial transactions from it.

        CRITICAL INSTRUCTIONS FOR CLASSIFYING INCOME VS EXPENSE:
        You must evaluate every transaction from the perspective of the account holder, "${businessName}".
        - Money going OUT of the account (e.g., payments made TO a supplier, bank fees, debit orders, purchases, card swipes) MUST be marked as "EXPENSE".
        - Money coming IN to the account (e.g., deposits, payments received FROM a client, credits) MUST be marked as "INCOME".
        Do not assume the business name is UROps. The business name is exactly "${businessName}".

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

        let result;
        if (textContent && textContent.trim().length > 0) {
            console.log("Sending extracted text of length", textContent.length, "to Gemini");
            const fullPrompt = `${prompt}\n\nHere is the transaction data extracted from the document:\n\n${textContent}`;
            result = await model.generateContent(fullPrompt);
        } else if (fileExtension === 'pdf') {
            console.log("Extracted text empty for PDF, sending base64 to Gemini direct");
            const base64Data = buffer.toString("base64");
            result = await model.generateContent([
                prompt,
                { inlineData: { data: base64Data, mimeType: "application/pdf" } }
            ]);
        } else {
            return { success: false, error: "Unable to extract text content from the file." };
        }

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
