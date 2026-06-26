import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { generateWorkSummary } from "@/lib/work-summary"

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const companyId = await ensureAuth()
        const leadId = params.id

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        })

        if (!lead || lead.companyId !== companyId) {
            return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 })
        }

        const summary = generateWorkSummary(lead)

        return NextResponse.json({
            ...lead,
            ...summary
        })
    } catch (error: any) {
        console.error("Error in GET /api/property/[id]:", error)
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
    }
}
