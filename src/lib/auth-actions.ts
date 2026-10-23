import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import React from "react"

const cache = (React as any).cache || ((fn: any) => fn)

export const getAuthCompanyId = cache(async () => {
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
