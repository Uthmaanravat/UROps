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
    if (!supabase) {
        console.error("DashboardLayout: Supabase client is null")
        redirect("/login")
    }

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

    // CRITICAL: Must JSON-serialize to avoid Date object issues with Client Components
    const serializedUser = JSON.parse(JSON.stringify(dbUser));
    const serializedSettings = JSON.parse(JSON.stringify(settings));

    return <DashboardLayoutClient user={serializedUser} settings={serializedSettings}>{children}</DashboardLayoutClient>
}
