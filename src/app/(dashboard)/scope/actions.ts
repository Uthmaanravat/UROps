'use server'

import { prisma } from "@/lib/prisma"
import { submitScopeOfWork } from "@/lib/workflow"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

export async function createMobileSOWAction(data: {
    clientId: string
    site: string
    date: string
    items: { description: string, area?: string }[]
}) {
    const companyId = await ensureAuth()
    // 1. Create a placeholder project for this scope
    const project = await prisma.project.create({
        data: {
            companyId,
            name: `${data.site || "New Project"} - ${new Date(data.date).toLocaleDateString()}`,
            clientId: data.clientId,
            status: 'SOW',
            workflowStage: 'SOW',
            description: `Mobile entry on ${data.date}`
        }
    })

    // 2. Submit the SOW using the existing workflow logic
    // This will create the SOW record and update the project status accordingly
    const sow = await submitScopeOfWork(project.id, data.items.map(i => ({
        description: i.description,
        area: i.area,
        quantity: 1
    })), data.site)

    revalidatePath("/manager")
    revalidatePath("/projects")
    revalidatePath("/work-breakdown-pricing")

    return { projectId: project.id, sowId: (sow as any).sow.id, wbpId: (sow as any).wbp.id }
}

export async function saveScopeDraftAction(data: {
    clientId: string
    site: string
    date: string
    items: { description: string, area?: string }[]
}) {
    const companyId = await ensureAuth()

    // 1. Create Project with PLANNING/SOW status
    const project = await prisma.project.create({
        data: {
            companyId,
            name: `${data.site || "Draft Scope"} - ${new Date(data.date).toLocaleDateString()}`,
            clientId: data.clientId,
            status: 'SOW', // Visible in pending lists
            workflowStage: 'SOW',
            description: `Draft mobile entry on ${data.date}`,
            commercialStatus: 'AWAITING_PO' // Default
        }
    })

    // 2. Create SOW Record with DRAFT status
    // We do NOT call submitScopeOfWork because that finalizes it
    const sow = await prisma.scopeOfWork.create({
        data: {
            companyId,
            projectId: project.id,
            status: 'DRAFT',
            version: 1,
            site: data.site,
            items: {
                create: data.items.map(i => ({
                    description: i.description,
                    area: i.area,
                    quantity: 1
                }))
            }
        }
    })

    revalidatePath("/manager")
    revalidatePath("/projects")

    return { projectId: project.id, sowId: sow.id }
}
