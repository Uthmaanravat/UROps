import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide"
import { completeOnboardingAction } from "@/app/actions/user"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export default async function OnboardingPage() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id }
    })

    if (dbUser?.hasCompletedOnboarding) {
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
