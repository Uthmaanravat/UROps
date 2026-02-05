'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createProject(data: {
    name: string
    clientId: string
    description?: string
    startDate?: Date
    endDate?: Date
    status?: string
}) {
    try {
        const project = await prisma.project.create({
            data: {
                name: data.name,
                clientId: data.clientId,
                description: data.description,
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
    try {
        const project = await prisma.project.update({
            where: { id },
            data
        })
        revalidatePath(`/projects/${id}`)
        return { success: true, data: project }
    } catch (error) {
        console.error("Error updating project:", error)
        return { success: false, error: "Failed to update project" }
    }
}

export async function deleteProject(id: string) {
    try {
        await prisma.project.delete({
            where: { id }
        })
        revalidatePath("/projects")
        return { success: true }
    } catch (error) {
        console.error("Error deleting project:", error)
        return { success: false, error: "Failed to delete project" }
    }
}

export async function updateProjectStatus(id: string, status: string) {
    try {
        await prisma.project.update({
            where: { id },
            data: { status: status as any }
        })
        revalidatePath(`/projects/${id}`)
        return { success: true }
    } catch (error) {
        console.error("Error updating project status:", error)
        return { success: false, error: "Failed to update status" }
    }
}
