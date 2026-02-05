'use server'

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function completeOnboardingAction() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("Not authenticated")
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { hasCompletedOnboarding: true }
    })

    revalidatePath("/")
    revalidatePath("/dashboard")
    redirect("/dashboard")
}

export async function getCurrentUser() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    return await prisma.user.findUnique({
        where: { id: user.id }
    })
}
