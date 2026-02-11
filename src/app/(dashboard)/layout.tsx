import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import DashboardLayoutClient from "./DashboardLayoutClient"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    try {
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
        let serializedUser = null;
        let serializedSettings = null;
        try {
            serializedUser = JSON.parse(JSON.stringify(dbUser));
            serializedSettings = JSON.parse(JSON.stringify(settings));
        } catch (serErr) {
            console.error("Layout Serialization Error:", serErr);
            // Fallback to basic object if stringify fails
            serializedUser = { ...dbUser, createdAt: String(dbUser.createdAt), updatedAt: String(dbUser.updatedAt) };
        }

        return <DashboardLayoutClient user={serializedUser} settings={serializedSettings}>{children}</DashboardLayoutClient>
    } catch (criticalError) {
        console.error("Dashboard Layout Critical Error:", criticalError);
        // If it's a redirect error, rethrow it
        if (criticalError instanceof Error && (criticalError.message === 'NEXT_REDIRECT' || criticalError.message.includes('redirect'))) {
            throw criticalError;
        }
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <div className="max-w-md w-full p-8 text-center bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900">
                    <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Workspace Error</h1>
                    <p className="text-sm text-muted-foreground mb-4">We encountered a problem loading your workspace layout.</p>
                    <a href="/login" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                        Return to Login
                    </a>
                </div>
            </div>
        );
    }
}
