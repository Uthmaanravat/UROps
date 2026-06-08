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
      orderBy: { createdAt: "desc" }
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
        items: { orderBy: { createdAt: "asc" } }
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
  coverImage?: string
  selectedSections?: any
  sectionOrder?: any
  date?: Date
  type?: string
  metadata?: any
  companyId: string
}) {
  try {
    const report = await prisma.report.create({
      data: {
        title: data.title,
        description: data.description,
        clientId: data.clientId,
        projectId: data.projectId,
        coverImage: data.coverImage,
        selectedSections: data.selectedSections,
        sectionOrder: data.sectionOrder,
        companyId: data.companyId,
        date: data.date || new Date(),
        type: data.type || "BASIC",
        metadata: data.metadata || null
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
    await prisma.report.delete({ where: { id } })
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
  imageUrls?: string[]
  location?: string
  severity?: string
  recommendation?: string
}) {
  try {
    const urls = data.imageUrls || (data.imageUrl ? [data.imageUrl] : [])
    const primaryUrl = urls[0] || null

    const count = await prisma.reportItem.count({
      where: { reportId: data.reportId }
    })

    const item = await prisma.reportItem.create({
      data: {
        reportId: data.reportId,
        description: data.description,
        title: data.title,
        imageUrl: primaryUrl,
        imageUrls: urls,
        location: data.location,
        severity: data.severity,
        recommendation: data.recommendation,
        order: count
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
    await prisma.reportItem.delete({ where: { id: itemId } })
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

export async function updateReportMetadata(reportId: string, type: string, metadata: any) {
  try {
    await prisma.report.update({
      where: { id: reportId },
      data: { type, metadata }
    })
    revalidatePath(`/reports/${reportId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to update report metadata:", error)
    return { success: false, error: "Failed to update report metadata" }
  }
}

export async function updateReportItem(data: {
  id: string
  reportId: string
  description: string
  title?: string
  imageUrl?: string
  imageUrls?: string[]
  location?: string
  severity?: string
  recommendation?: string
}) {
  try {
    const urls = data.imageUrls || (data.imageUrl ? [data.imageUrl] : [])
    const primaryUrl = urls[0] || null
    await prisma.reportItem.update({
      where: { id: data.id },
      data: {
        description: data.description,
        title: data.title,
        imageUrl: primaryUrl,
        imageUrls: urls,
        location: data.location,
        severity: data.severity,
        recommendation: data.recommendation
      }
    })
    revalidatePath(`/reports/${data.reportId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to update report item:", error)
    return { success: false, error: "Failed to update report item" }
  }
}

export async function reorderReportItem(itemId: string, reportId: string, direction: "up" | "down") {
  try {
    const items = await prisma.reportItem.findMany({
      where: { reportId },
      orderBy: [
        { order: "asc" },
        { createdAt: "asc" }
      ]
    })
    
    const index = items.findIndex(item => item.id === itemId)
    if (index === -1) return { success: false, error: "Item not found" }
    
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= items.length) {
      return { success: true } // No-op
    }
    
    const currentItem = items[index]
    const swapItem = items[swapIndex]
    
    const currentOrder = currentItem.order || index
    const swapOrder = swapItem.order || swapIndex
    
    if (currentOrder === swapOrder) {
      for (let i = 0; i < items.length; i++) {
        await prisma.reportItem.update({
          where: { id: items[i].id },
          data: { order: i }
        })
      }
      return reorderReportItem(itemId, reportId, direction)
    }
    
    await prisma.$transaction([
      prisma.reportItem.update({
        where: { id: currentItem.id },
        data: { order: swapOrder }
      }),
      prisma.reportItem.update({
        where: { id: swapItem.id },
        data: { order: currentOrder }
      })
    ])
    
    revalidatePath(`/reports/${reportId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to reorder report item:", error)
    return { success: false, error: "Failed to reorder report item" }
  }
}

export async function updateReportDetails(data: {
  id: string
  title: string
  date: Date
  clientId?: string
  projectId?: string
}) {
  try {
    await prisma.report.update({
      where: { id: data.id },
      data: {
        title: data.title,
        date: data.date,
        clientId: data.clientId || null,
        projectId: data.projectId || null
      }
    })
    revalidatePath(`/reports/${data.id}`)
    revalidatePath("/reports")
    return { success: true }
  } catch (error) {
    console.error("Failed to update report details:", error)
    return { success: false, error: "Failed to update report details" }
  }
}
