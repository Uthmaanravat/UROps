import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide"
import { completeOnboardingAction } from "@/app/actions/user"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export default async function OnboardingPage() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    console.log("OnboardingPage: Supabase user:", user?.id)

    if (!user) {
        redirect("/login")
    }

    let dbUser = await prisma.user.findUnique({
        where: { id: user.id }
    })

    if (!dbUser) {
        const email = user.email!
        const domain = email.split("@")[1].toLowerCase()

        let company = await prisma.company.findUnique({
            where: { domain }
        })

        if (!company) {
            company = await prisma.company.create({
                data: {
                    name: domain.split(".")[0].toUpperCase(),
                    domain,
                    settings: {
                        create: {
                            name: domain.split(".")[0].toUpperCase()
                        }
                    }
                }
            })
        }

        console.log("OnboardingPage: Creating new user in Prisma with connect syntax")
        dbUser = await prisma.user.create({
            data: {
                id: user.id,
                email,
                name: user.user_metadata.full_name,
                role: user.user_metadata.role || 'MANAGER',
                company: { connect: { id: company.id } }
            }
        })
        console.log("OnboardingPage: New user created:", dbUser.id)
    }

    if (dbUser.hasCompletedOnboarding) {
        redirect("/dashboard")
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background bg-grid-white/[0.02] relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
            <div className="w-full max-w-2xl relative z-10">
                <OnboardingGuide onComplete={completeOnboardingAction} />
            </div>
        </div>
    )
}
