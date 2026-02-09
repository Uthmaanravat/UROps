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
        console.warn("DashboardLayout: Supabase client is null")
        redirect("/login")
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    console.log("DashboardLayout check for user ID:", user.id)
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
    console.log("DashboardLayout dbUser found:", dbUser ? "YES" : "NO")

    if (!dbUser) {
        // If user exists in Supabase but not in Prisma, try to sync
        const email = user.email!
        console.log("DashboardLayout: User not found, syncing for domain from email:", email)
        const domain = email.split("@")[1]?.toLowerCase()
        if (!domain) {
            console.error("DashboardLayout: Invalid email domain")
            return <div>Invalid email domain. Please contact support.</div>
        }

        // Find or create company
        console.log("DashboardLayout: Finding company for domain:", domain)
        let company = await prisma.company.findUnique({
            where: { domain },
            include: { settings: true }
        })
        console.log("DashboardLayout: Company found:", company ? "YES" : "NO")

        if (!company) {
            console.log("DashboardLayout: Creating new company for domain:", domain)
            const createdCompany = await prisma.company.create({
                data: {
                    name: domain.split(".")[0].toUpperCase(),
                    domain,
                    settings: {
                        create: {
                            name: domain.split(".")[0].toUpperCase()
                        }
                    }
                },
                include: { settings: true }
            })
            company = createdCompany
            console.log("DashboardLayout: New company created:", company.id)
        }

        console.log("DashboardLayout: Creating new user in Prisma with connect syntax")
        const newUser = await prisma.user.create({
            data: {
                id: user.id,
                email,
                name: user.user_metadata.full_name,
                role: user.user_metadata.role || 'MANAGER',
                companyId: company.id
            }
        })
        console.log("DashboardLayout: New user created:", newUser.id)

        if (!newUser.hasCompletedOnboarding) {
            redirect("/onboarding")
        }

        return <DashboardLayoutClient user={newUser} settings={company.settings}>{children}</DashboardLayoutClient>
    }

    if (!dbUser.hasCompletedOnboarding) {
        redirect("/onboarding")
    }

    const settings = dbUser.company?.settings || null;
    console.log("DashboardLayout: Settings found via include:", settings ? "YES" : "NO")

    return <DashboardLayoutClient user={dbUser} settings={settings}>{children}</DashboardLayoutClient>
}
