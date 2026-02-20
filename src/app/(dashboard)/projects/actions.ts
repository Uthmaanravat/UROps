'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ensureAuth } from "@/lib/auth-actions"

export async function createProject(data: {
    name: string
    clientId: string
    description?: string
    startDate?: Date
    endDate?: Date
    status?: string
}) {
    const companyId = await ensureAuth()
    try {
        const project = await prisma.project.create({
            data: {
                companyId,
                name: data.name.toUpperCase(),
                clientId: data.clientId,
                description: data.description?.toUpperCase(),
                status: data.status || 'PLANNING' as any,
                startDate: data.startDate,
                endDate: data.endDate
            }
        })

        revalidatePath("/projects")
        revalidatePath(`/clients/${data.clientId}`)
        return { success: true, data: project }
    } catch (error) {
        console.error("Error creating project:", error)
        return { success: false, error: "Failed to create project" }
    }
}

export async function updateProject(id: string, data: any) {
    const companyId = await ensureAuth()
    try {
        const updateData = { ...data };
        if (updateData.name) updateData.name = updateData.name.toUpperCase();
        if (updateData.description) updateData.description = updateData.description.toUpperCase();

        const project = await prisma.project.update({
            where: { id, companyId },
            data: updateData
        })
        revalidatePath(`/projects/${id}`)
        return { success: true, data: project }
    } catch (error) {
        console.error("Error updating project:", error)
        return { success: false, error: "Failed to update project" }
    }
}

export async function deleteProject(id: string) {
    const companyId = await ensureAuth()
    try {
        await prisma.project.delete({
            where: { id, companyId }
        })
        revalidatePath("/projects")
        return { success: true }
    } catch (error) {
        console.error("Error deleting project:", error)
        return { success: false, error: "Failed to delete project" }
    }
}

export async function updateProjectStatus(id: string, status: string) {
    const companyId = await ensureAuth()
    try {
        await prisma.project.update({
            where: { id, companyId },
            data: { status: status as any }
        })
        revalidatePath(`/projects/${id}`)
        return { success: true }
    } catch (error) {
        console.error("Error updating project status:", error)
        return { success: false, error: "Failed to update status" }
    }
}

export async function updateProjectCommercialStatus(id: string, commercialStatus: any) {
    const companyId = await ensureAuth()
    try {
        await (prisma as any).project.update({
            where: { id, companyId },
            data: { commercialStatus }
        })
        revalidatePath("/projects")
        revalidatePath(`/projects/${id}`)
        return { success: true }
    } catch (error) {
        console.error("Error updating commercial status:", error)
        return { success: false, error: "Failed to update commercial status" }
    }
}
