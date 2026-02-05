"use server"

import { parseScopeOfWork } from "@/app/actions/ai"

export async function parseScopeAction(text: string) {
    const result = await parseScopeOfWork(text);
    return result.items;
}
