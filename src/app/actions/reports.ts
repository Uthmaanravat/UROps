"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getReports(companyId: string) {
    try {
        return await prisma.report.findMany({
            where: { companyId },
            include: {
                client: { select: { name: true, companyName: true } },
                project: { select: { name: true } },
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
    } catch (error) {
        console.error("Failed to fetch reports:", error)
        return []
    }
}

export async function getReportById(id: string) {
    try {
        return await prisma.report.findUnique({
            where: { id },
            include: {
                client: true,
                project: true,
                items: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        })
    } catch (error) {
        console.error("Failed to fetch report:", error)
        return null
    }
}

export async function createReport(data: {
    title: string
    description?: string
    clientId?: string
    projectId?: string
    companyId: string
    date?: Date
}) {
    try {
        const report = await prisma.report.create({
            data: {
                title: data.title,
                description: data.description,
                clientId: data.clientId,
                projectId: data.projectId,
                companyId: data.companyId,
                date: data.date || new Date()
            }
        })
        revalidatePath("/reports")
        return { success: true, report }
    } catch (error) {
        console.error("Failed to create report:", error)
        return { success: false, error: "Failed to create report" }
    }
}

export async function deleteReport(id: string) {
    try {
        await prisma.report.delete({
            where: { id }
        })
        revalidatePath("/reports")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete report:", error)
        return { success: false, error: "Failed to delete report" }
    }
}

export async function addReportItem(data: {
    reportId: string
    description: string
    title?: string
    imageUrl?: string
}) {
    try {
        const item = await prisma.reportItem.create({
            data: {
                reportId: data.reportId,
                description: data.description,
                title: data.title,
                imageUrl: data.imageUrl
            }
        })
        revalidatePath(`/reports/${data.reportId}`)
        return { success: true, item }
    } catch (error) {
        console.error("Failed to add report item:", error)
        return { success: false, error: "Failed to add report item" }
    }
}

export async function deleteReportItem(itemId: string, reportId: string) {
    try {
        await prisma.reportItem.delete({
            where: { id: itemId }
        })
        revalidatePath(`/reports/${reportId}`)
        return { success: true }
    } catch (error) {
        console.error("Failed to delete report item:", error)
        return { success: false, error: "Failed to delete report item" }
    }
}

export async function updateReportConclusion(reportId: string, conclusion: string) {
    try {
        await prisma.report.update({
            where: { id: reportId },
            data: { conclusion }
        })
        revalidatePath(`/reports/${reportId}`)
        return { success: true }
    } catch (error) {
        console.error("Failed to update conclusion:", error)
        return { success: false, error: "Failed to update conclusion" }
    }
}
