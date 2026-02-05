import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import DashboardLayoutClient from "./DashboardLayoutClient"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id }
    })

    if (!dbUser) {
        // If user exists in Supabase but not in Prisma, try to sync
        const newUser = await prisma.user.create({
            data: {
                id: user.id,
                email: user.email!,
                name: user.user_metadata.full_name,
                role: user.user_metadata.role || 'MANAGER'
            }
        })

        if (!newUser.hasCompletedOnboarding) {
            redirect("/onboarding")
        }

        return <DashboardLayoutClient user={newUser} settings={null}>{children}</DashboardLayoutClient>
    }

    if (!dbUser.hasCompletedOnboarding) {
        redirect("/onboarding")
    }

    const settings = await prisma.companySettings.findUnique({
        where: { id: "default" }
    })

    return <DashboardLayoutClient user={dbUser} settings={settings}>{children}</DashboardLayoutClient>
}
