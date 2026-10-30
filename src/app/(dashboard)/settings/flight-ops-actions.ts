'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"

function parseOptionalFloat(val: any): number | null {
    if (val === undefined || val === null || String(val).trim() === '') return null
    const n = parseFloat(String(val))
    return isNaN(n) ? null : n
}

export async function updateFlightWeatherLimitsAction(input: {
    sprayDriftWarnKmh?: number | string | null
    windWarnKmh?: number | string | null
    windLimitKmh?: number | string | null
    gustWarnKmh?: number | string | null
    gustLimitKmh?: number | string | null
    rainLimitMm?: number | string | null
}) {
    try {
        const companyId = await ensureAuth()
        const authUser = await getAuthUser()
        if (!authUser || authUser.role !== 'ADMIN') {
            return { success: false, error: "Only company admins can update flight weather limits." }
        }

        const sprayDriftWarnKmh = parseOptionalFloat(input.sprayDriftWarnKmh)
        const windWarnKmh = parseOptionalFloat(input.windWarnKmh)
        const windLimitKmh = parseOptionalFloat(input.windLimitKmh)
        const gustWarnKmh = parseOptionalFloat(input.gustWarnKmh)
        const gustLimitKmh = parseOptionalFloat(input.gustLimitKmh)
        const rainLimitMm = parseOptionalFloat(input.rainLimitMm)

        const anyConfigured = [
            sprayDriftWarnKmh,
            windWarnKmh,
            windLimitKmh,
            gustWarnKmh,
            gustLimitKmh,
            rainLimitMm
        ].some(v => v !== null)

        await prisma.companySettings.upsert({
            where: { companyId },
            update: {
                weatherLimitsConfigured: anyConfigured,
                sprayDriftWarnKmh,
                windWarnKmh,
                windLimitKmh,
                gustWarnKmh,
                gustLimitKmh,
                rainLimitMm
            },
            create: {
                companyId,
                weatherLimitsConfigured: anyConfigured,
                sprayDriftWarnKmh,
                windWarnKmh,
                windLimitKmh,
                gustWarnKmh,
                gustLimitKmh,
                rainLimitMm
            }
        })

        revalidatePath("/settings")
        revalidatePath("/calendar")
        revalidatePath("/projects")
        revalidatePath("/my-jobs")
        return { success: true, weatherLimitsConfigured: anyConfigured }
    } catch (e: any) {
        console.error("updateFlightWeatherLimitsAction error:", e)
        return { success: false, error: e.message || "Failed to save weather limits" }
    }
}

export async function getCompanyDronesAction() {
    try {
        const companyId = await ensureAuth()
        const drones = await prisma.drone.findMany({
            where: { companyId },
            orderBy: { createdAt: 'asc' }
        })
        return drones
    } catch (e) {
        console.warn("getCompanyDronesAction fallback (table may await migration):", e)
        return []
    }
}

export async function createDroneAction(input: {
    name: string
    serialNumber: string
    model?: string
}) {
    try {
        const companyId = await ensureAuth()
        const authUser = await getAuthUser()
        if (!authUser || authUser.role !== 'ADMIN') {
            return { success: false, error: "Only admins can manage aircraft." }
        }
        if (!input.name?.trim() || !input.serialNumber?.trim()) {
            return { success: false, error: "Aircraft name and serial number are required." }
        }

        const drone = await prisma.drone.create({
            data: {
                companyId,
                name: input.name.trim(),
                serialNumber: input.serialNumber.trim(),
                model: input.model?.trim() || "JTC10",
                isActive: true
            }
        })

        revalidatePath("/settings")
        revalidatePath("/projects")
        revalidatePath("/my-jobs")
        return { success: true, drone }
    } catch (e: any) {
        console.error("createDroneAction error:", e)
        return { success: false, error: e.message || "Failed to add aircraft" }
    }
}

export async function toggleDroneActiveAction(droneId: string, isActive: boolean) {
    try {
        const companyId = await ensureAuth()
        const authUser = await getAuthUser()
        if (!authUser || authUser.role !== 'ADMIN') {
            return { success: false, error: "Only admins can manage aircraft." }
        }
        await prisma.drone.updateMany({
            where: { id: droneId, companyId },
            data: { isActive }
        })
        revalidatePath("/settings")
        revalidatePath("/my-jobs")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to update aircraft" }
    }
}

export async function deleteDroneAction(droneId: string) {
    try {
        const companyId = await ensureAuth()
        const authUser = await getAuthUser()
        if (!authUser || authUser.role !== 'ADMIN') {
            return { success: false, error: "Only admins can delete aircraft." }
        }
        await prisma.drone.deleteMany({
            where: { id: droneId, companyId }
        })
        revalidatePath("/settings")
        revalidatePath("/my-jobs")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to delete aircraft" }
    }
}
