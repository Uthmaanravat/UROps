"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

export async function getReports(providedCompanyId?: string) {
  try {
    const companyId = await ensureAuth()
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
    const companyId = await ensureAuth()
    return await prisma.report.findFirst({
      where: { id, companyId },
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
  companyId?: string
}) {
  try {
    const companyId = await ensureAuth()

    if (data.clientId) {
      const client = await prisma.client.findFirst({ where: { id: data.clientId, companyId } })
      if (!client) return { success: false, error: "Client not found or unauthorized" }
    }

    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, companyId } })
      if (!project) return { success: false, error: "Project not found or unauthorized" }
    }

    const report = await prisma.report.create({
      data: {
        title: data.title,
        description: data.description,
        clientId: data.clientId || null,
        projectId: data.projectId || null,
        coverImage: data.coverImage,
        selectedSections: data.selectedSections,
        sectionOrder: data.sectionOrder,
        companyId,
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
    const companyId = await ensureAuth()
    const result = await prisma.report.deleteMany({
      where: { id, companyId }
    })
    if (result.count === 0) {
      return { success: false, error: "Report not found or unauthorized" }
    }
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
    const companyId = await ensureAuth()
    const report = await prisma.report.findFirst({
      where: { id: data.reportId, companyId }
    })
    if (!report) return { success: false, error: "Report not found or unauthorized" }

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
    const companyId = await ensureAuth()
    const report = await prisma.report.findFirst({
      where: { id: reportId, companyId }
    })
    if (!report) return { success: false, error: "Report not found or unauthorized" }

    await prisma.reportItem.deleteMany({
      where: { id: itemId, reportId }
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
    const companyId = await ensureAuth()
    const result = await prisma.report.updateMany({
      where: { id: reportId, companyId },
      data: { conclusion }
    })
    if (result.count === 0) return { success: false, error: "Report not found or unauthorized" }

    revalidatePath(`/reports/${reportId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to update conclusion:", error)
    return { success: false, error: "Failed to update conclusion" }
  }
}

export async function updateReportMetadata(reportId: string, type: string, metadata: any) {
  try {
    const companyId = await ensureAuth()
    const result = await prisma.report.updateMany({
      where: { id: reportId, companyId },
      data: { type, metadata }
    })
    if (result.count === 0) return { success: false, error: "Report not found or unauthorized" }

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
    const companyId = await ensureAuth()
    const report = await prisma.report.findFirst({
      where: { id: data.reportId, companyId }
    })
    if (!report) return { success: false, error: "Report not found or unauthorized" }

    const urls = data.imageUrls || (data.imageUrl ? [data.imageUrl] : [])
    const primaryUrl = urls[0] || null

    const result = await prisma.reportItem.updateMany({
      where: { id: data.id, reportId: data.reportId },
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
    if (result.count === 0) return { success: false, error: "Report item not found or unauthorized" }

    revalidatePath(`/reports/${data.reportId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to update report item:", error)
    return { success: false, error: "Failed to update report item" }
  }
}

export async function reorderReportItem(itemId: string, reportId: string, direction: "up" | "down") {
  try {
    const companyId = await ensureAuth()
    const report = await prisma.report.findFirst({
      where: { id: reportId, companyId }
    })
    if (!report) return { success: false, error: "Report not found or unauthorized" }

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
      return { success: true }
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
    const companyId = await ensureAuth()

    if (data.clientId) {
      const client = await prisma.client.findFirst({ where: { id: data.clientId, companyId } })
      if (!client) return { success: false, error: "Client not found or unauthorized" }
    }

    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, companyId } })
      if (!project) return { success: false, error: "Project not found or unauthorized" }
    }

    const result = await prisma.report.updateMany({
      where: { id: data.id, companyId },
      data: {
        title: data.title,
        date: data.date,
        clientId: data.clientId || null,
        projectId: data.projectId || null
      }
    })
    if (result.count === 0) return { success: false, error: "Report not found or unauthorized" }

    revalidatePath(`/reports/${data.id}`)
    revalidatePath("/reports")
    return { success: true }
  } catch (error) {
    console.error("Failed to update report details:", error)
    return { success: false, error: "Failed to update report details" }
  }
}

export async function createProjectCompletionReportAction(projectId: string) {
    try {
        const companyId = await ensureAuth()
        const project = await prisma.project.findUnique({
            where: { id: projectId, companyId },
            include: {
                client: true,
                invoices: {
                    where: { type: 'QUOTE' },
                    orderBy: { createdAt: 'desc' }
                }
            }
        })
        if (!project) throw new Error("Project not found")

        const quote = project.invoices[0]
        const quoteMeta = (quote?.metadata as any) || {}
        const elevations = quoteMeta.elevations || []
        const photos = quoteMeta.siteVisitPhotos || []

        const report = await prisma.report.create({
            data: {
                companyId,
                projectId: project.id,
                clientId: project.clientId,
                title: `Facade Maintenance Completion Report – ${project.name}`,
                description: `Official completion inspection and handover report for facade maintenance work performed at ${quote?.site || project.name}.`,
                date: new Date(),
                type: 'AEROWASH_COMPLETION',
                metadata: {
                    elevations,
                    beforePhotos: photos,
                    quoteNumber: quote?.quoteNumber || quote?.number,
                    site: quote?.site || project.name
                }
            }
        })

        revalidatePath(`/projects/${projectId}`)
        revalidatePath(`/reports`)
        return { success: true, reportId: report.id }
    } catch (e: any) {
        console.error("createProjectCompletionReportAction error:", e)
        return { success: false, error: e.message || "Failed to create completion report" }
    }
}
