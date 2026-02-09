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
        where: { id: user.id },
        include: {
            company: {
                include: {
                    settings: true
                }
            }
        }
    })

    if (!dbUser) {
        redirect("/login")
    }

    if (!dbUser.hasCompletedOnboarding) {
        redirect("/onboarding")
    }

    const settings = dbUser.company?.settings || null;

    return <DashboardLayoutClient user={dbUser as any} settings={settings as any}>{children}</DashboardLayoutClient>
}
