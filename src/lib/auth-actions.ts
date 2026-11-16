import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import React from "react"
import {
    canUserAccessWorkspace,
    getCompanyIdForWorkspace,
    detectWorkspaceFromHeaders,
    WorkspaceType
} from "@/lib/workspace-auth"

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

    if (!dbUser) return null

    // Determine active company strictly from request headers (x-workspace, x-pathname, next-url, referer).
    // Never mutate User.companyId in the database, and never read/write a shared cookie,
    // ensuring concurrent tabs/PWAs in separate workspaces never contaminate each other.
    let headersList: Headers | null = null
    try {
        headersList = headers()
    } catch {}

    if (headersList) {
        const detectedWorkspace = detectWorkspaceFromHeaders(headersList)
        if (detectedWorkspace) {
            const hasAccess = await canUserAccessWorkspace(dbUser, detectedWorkspace)
            if (hasAccess) {
                dbUser.companyId = getCompanyIdForWorkspace(detectedWorkspace)
            }
        }
    }

    return dbUser
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
