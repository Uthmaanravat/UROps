'use server'

import { prisma } from "@/lib/prisma"
import { submitScopeOfWork } from "@/lib/workflow"
import { revalidatePath } from "next/cache"

export async function createMobileSOWAction(data: {
    clientId: string
    site: string
    date: string
    items: { description: string }[]
}) {
    // 1. Create a placeholder project for this scope
    const project = await prisma.project.create({
        data: {
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
        quantity: 1
    })), data.site)

    revalidatePath("/manager")
    revalidatePath("/projects")
    revalidatePath("/work-breakdown-pricing")

    return { projectId: project.id, sowId: (sow as any).sow.id, wbpId: (sow as any).wbp.id }
}
