import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

import { cache } from "react"

export const getAuthCompanyId = cache(async () => {
    const supabase = createClient()
    if (!supabase) return null

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { companyId: true }
    })

    return dbUser?.companyId || null
})

export async function ensureAuth() {
    const companyId = await getAuthCompanyId()
    if (!companyId) {
        redirect("/login")
    }
    return companyId
}
