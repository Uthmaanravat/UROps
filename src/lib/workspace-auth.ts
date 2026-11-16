import { prisma } from "@/lib/prisma"

export const AEROWASH_COMPANY_ID = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'
export const LRBUILDERS_COMPANY_ID = '299c43ec-9578-4c45-91cb-a881a539e25d'

export const OWNER_EMAILS = [
    'uthmaan@aerowash.co.za',
    'uthmaan@lrbuilders.co.za',
    'uthmaanravat123@gmail.com',
    'uraerialsolutions@gmail.com',
    'utiravat@gmail.com'
]

export type WorkspaceType = 'aerowash' | 'lrbuilders'

export function getCompanyIdForWorkspace(workspace: WorkspaceType): string {
    return workspace === 'aerowash' ? AEROWASH_COMPANY_ID : LRBUILDERS_COMPANY_ID
}

export function getWorkspaceForCompanyId(companyId: string): WorkspaceType | null {
    if (companyId === AEROWASH_COMPANY_ID) return 'aerowash'
    if (companyId === LRBUILDERS_COMPANY_ID) return 'lrbuilders'
    return null
}

export function detectWorkspaceFromHeaders(headersList: { get: (name: string) => string | null }): WorkspaceType | null {
    // 1. Check custom per-tab workspace header (e.g. x-workspace)
    const explicitWorkspace = headersList.get('x-workspace')
    if (explicitWorkspace === 'aerowash' || explicitWorkspace === 'lrbuilders') {
        return explicitWorkspace
    }

    // 2. Check x-pathname (set by middleware from request.nextUrl.pathname)
    const pathname = headersList.get('x-pathname') || ''
    if (pathname.startsWith('/app/aerowash')) return 'aerowash'
    if (pathname.startsWith('/app/lrbuilders')) return 'lrbuilders'

    // 3. Check next-url (Next.js internal routing header for RSC and actions)
    const nextUrl = headersList.get('next-url') || ''
    if (nextUrl.startsWith('/app/aerowash')) return 'aerowash'
    if (nextUrl.startsWith('/app/lrbuilders')) return 'lrbuilders'

    // 4. Check referer (sent automatically by browser on every tab request/action)
    const referer = headersList.get('referer') || ''
    if (referer) {
        try {
            const url = new URL(referer)
            if (url.pathname.startsWith('/app/aerowash')) return 'aerowash'
            if (url.pathname.startsWith('/app/lrbuilders')) return 'lrbuilders'
        } catch {
            if (referer.includes('/app/aerowash')) return 'aerowash'
            if (referer.includes('/app/lrbuilders')) return 'lrbuilders'
        }
    }

    return null
}

export async function canUserAccessWorkspace(
    user: { id?: string; email?: string | null; role?: string; isOwner?: boolean; companyId?: string },
    workspace: WorkspaceType
): Promise<boolean> {
    if (!user || !user.email) return false

    const email = user.email.toLowerCase().trim()
    const targetCompanyId = getCompanyIdForWorkspace(workspace)

    // 1. System owner / executive emails have full access to both companies
    if (user.isOwner || OWNER_EMAILS.includes(email)) {
        return true
    }

    // 2. Direct current company match
    if (user.companyId === targetCompanyId) {
        return true
    }

    // 3. Database check: does this email have an associated user profile for the target company?
    const matchingProfile = await prisma.user.findFirst({
        where: {
            email: { equals: email, mode: 'insensitive' },
            companyId: targetCompanyId
        },
        select: { id: true, companyId: true }
    })

    return !!matchingProfile
}

/**
 * Workspace switching is strictly stateless and per-tab URL/scope driven.
 * Database mutations are prohibited so that concurrent tabs in separate companies
 * never contaminate each other's active session or data.
 */
export async function switchUserWorkspace(
    userId: string,
    workspace: WorkspaceType
): Promise<{ success: boolean; companyId: string }> {
    const targetCompanyId = getCompanyIdForWorkspace(workspace)
    return { success: true, companyId: targetCompanyId }
}
