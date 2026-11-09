import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import React from "react"

const cache = (React as any).cache || ((fn: any) => fn)

export const getAuthUser = cache(async () => {
    const supabase = createClient()
    if (!supabase) return null

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const dbUser = await prisma.user.findFirst({
        where: {
            OR: [
                { id: user.id },
                { email: { equals: user.email?.trim().toLowerCase(), mode: 'insensitive' } }
            ]
        },
        select: { id: true, email: true, name: true, role: true, isOwner: true, companyId: true }
    })

    return dbUser || null
})

export const getAuthCompanyId = cache(async () => {
    const user = await getAuthUser()
    return user?.companyId || null
})

export async function ensureAuth(options?: { allowCrew?: boolean }) {
    const user = await getAuthUser()
    if (!user?.companyId) {
        redirect("/login")
    }
    if (user.role === "CREW" && !options?.allowCrew) {
        redirect("/my-jobs")
    }
    return user.companyId
}
