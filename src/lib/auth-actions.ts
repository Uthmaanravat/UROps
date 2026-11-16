import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { headers, cookies } from "next/headers"
import React from "react"
import {
    canUserAccessWorkspace,
    getCompanyIdForWorkspace,
    switchUserWorkspace,
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

    // Check if a specific workspace is requested via route path or active cookie
    let pathname = ""
    try {
        pathname = headers().get('x-pathname') || ""
    } catch {}

    let cookieWorkspace: string | undefined
    try {
        cookieWorkspace = cookies().get('active_workspace')?.value
    } catch {}

    const requestedWorkspace: WorkspaceType | null =
        pathname.startsWith('/app/aerowash') ? 'aerowash' :
        pathname.startsWith('/app/lrbuilders') ? 'lrbuilders' :
        (cookieWorkspace === 'aerowash' || cookieWorkspace === 'lrbuilders') ? (cookieWorkspace as WorkspaceType) :
        null

    if (requestedWorkspace) {
        const targetCompanyId = getCompanyIdForWorkspace(requestedWorkspace)
        const hasAccess = await canUserAccessWorkspace(dbUser, requestedWorkspace)
        if (hasAccess && dbUser.companyId !== targetCompanyId) {
            dbUser.companyId = targetCompanyId
            // Sync database asynchronously
            switchUserWorkspace(dbUser.id, requestedWorkspace).catch(() => {})
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
