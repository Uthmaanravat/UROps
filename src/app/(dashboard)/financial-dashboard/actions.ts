"use server"

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { revalidatePath } from "next/cache"
import pdfParse from 'pdf-parse'
import { generateContentWithFallback } from "@/lib/ai"

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

        const prompt = `You are an expert AI accounting assistant.
        I am providing you with a bank statement, expense report, or transaction list file for a business named "${businessName}".
        Please carefully extract all financial transactions from it.

        CRITICAL INSTRUCTIONS FOR CLASSIFYING INCOME VS EXPENSE:
        You must evaluate every transaction from the perspective of the account holder, "${businessName}".
        - Money going OUT of the account (e.g., payments made TO a supplier, bank fees, debit orders, purchases, card swipes, cash/ATM withdrawals) MUST be marked as "EXPENSE".
        - Money coming IN to the account (e.g., deposits, payments received FROM a client, credits) MUST be marked as "INCOME".
        Do not assume the business name is UROps. The business name is exactly "${businessName}".

        SPECIAL INSTRUCTION FOR ATM & CASH WITHDRAWALS:
        - In South African bank statements, descriptions like "Atm Withdrawal", "Atm Wdl", "Atm Wdl Corr", "Cash Withdrawal", etc. represent ATM CASH WITHDRAWALS.
        - "Corr" stands for "Correspondent ATM" (Saswitch), NOT Correction or Credit!
        - These are ALWAYS money going OUT ("EXPENSE"). They are NEVER "INCOME" or revenue.
        - Whenever an ATM or cash withdrawal is made, it is used for wages: ALWAYS set category to "Salaries/Wages".
        - If a statement lists both "Atm Withdrawal [Location]" and an accompanying line "Atm Wdl Corr [Location]" for the same withdrawal, do NOT duplicate it. Extract only ONE transaction.

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
            result = await generateContentWithFallback(genAI, fullPrompt, { responseMimeType: "application/json" });
        } else if (fileExtension === 'pdf') {
            console.log("Extracted text empty for PDF, sending base64 to Gemini direct");
            const base64Data = buffer.toString("base64");
            result = await generateContentWithFallback(genAI, [
                prompt,
                { inlineData: { data: base64Data, mimeType: "application/pdf" } }
            ], { responseMimeType: "application/json" });
        } else {
            return { success: false, error: "Unable to extract text content from the file." };
        }

        const textResponse = result.response.text();
        const parsed = JSON.parse(textResponse);
        const transactions = parsed.transactions || [];

        // Sanitize and deduplicate transactions
        const sanitizedTransactions: any[] = [];
        const seenWithdrawals = new Set<string>();

        for (const t of transactions) {
            const desc = (t.description || "").trim();
            const lowerDesc = desc.toLowerCase();
            const amount = Math.abs(Number(t.amount) || 0);
            
            let parsedDate = new Date();
            if (t.date) {
                const d = new Date(t.date);
                if (!isNaN(d.getTime())) {
                    parsedDate = d;
                }
            }
            const dateStr = parsedDate.toISOString().split('T')[0];

            // Check for ATM / cash withdrawal keywords
            const isAtmOrCashWithdrawal = 
                lowerDesc.includes('atm wdl') || 
                lowerDesc.includes('atm withdrawal') || 
                lowerDesc.includes('cash withdrawal') ||
                lowerDesc.startsWith('atm ') ||
                /\batm\b.*\b(wdl|withdraw)/i.test(lowerDesc);

            if (isAtmOrCashWithdrawal) {
                // Deduplicate narrative duplicates (e.g. "Atm Withdrawal X" and "Atm Wdl Corr X" on same date with same amount)
                const key = `${dateStr}_${amount}`;
                if (seenWithdrawals.has(key)) {
                    continue; // Skip duplicate narrative line
                }
                seenWithdrawals.add(key);

                sanitizedTransactions.push({
                    companyId,
                    date: parsedDate,
                    description: desc,
                    amount,
                    type: 'EXPENSE' as const,
                    category: 'Salaries/Wages',
                    source: 'Bank Upload'
                });
                continue;
            }

            sanitizedTransactions.push({
                companyId,
                date: parsedDate,
                description: desc,
                amount,
                type: t.type === 'INCOME' ? ('INCOME' as const) : ('EXPENSE' as const),
                category: t.category || 'Miscellaneous',
                source: 'Bank Upload'
            });
        }

        // Save to database
        const createdCount = await prisma.transaction.createMany({
            data: sanitizedTransactions
        });

        revalidatePath('/financial-dashboard');
        return { success: true, count: createdCount.count };
    } catch (error: any) {
        console.error("Statement processing error:", error);
        let userMessage = error.message || "Failed to process statement";
        if (userMessage.includes("503") || userMessage.includes("high demand") || userMessage.includes("Service Unavailable")) {
            userMessage = "Google AI is currently experiencing high demand. Please try uploading again in a few moments, or upload a CSV / Excel spreadsheet directly.";
        }
        return { success: false, error: userMessage };
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
    
    let parsedDate = new Date();
    if (data.date) {
        const d = new Date(data.date);
        if (!isNaN(d.getTime())) {
            parsedDate = d;
        }
    }

    await prisma.transaction.create({
        data: {
            companyId,
            date: parsedDate,
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

export async function deleteTransactionAction(transactionId: string) {
    const companyId = await ensureAuth();
    await prisma.transaction.deleteMany({
        where: {
            id: transactionId,
            companyId
        }
    });

    revalidatePath('/financial-dashboard');
    return { success: true };
}

export async function clearUploadedTransactionsAction() {
    const companyId = await ensureAuth();
    const result = await prisma.transaction.deleteMany({
        where: {
            companyId,
            source: 'Bank Upload'
        }
    });

    revalidatePath('/financial-dashboard');
    return { success: true, count: result.count };
}
