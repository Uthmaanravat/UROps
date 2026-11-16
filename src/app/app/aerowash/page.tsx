import React from "react"
import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/auth-actions"
import {
    canUserAccessWorkspace,
    switchUserWorkspace,
    AEROWASH_COMPANY_ID,
} from "@/lib/workspace-auth"
import WorkspaceAccessDenied from "@/components/auth/WorkspaceAccessDenied"
import { LogIn, ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "AeroWash",
    description: "AeroWash Drone Cleaning Solutions & Operations Command Center",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "AeroWash",
    },
    icons: {
        apple: "/icons/aerowash/apple-touch-icon.png",
        icon: "/icons/aerowash/icon-512x512.png",
    },
}

export default async function AeroWashAppPage() {
    const user = await getAuthUser()

    if (!user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center">
                    <div className="mx-auto w-24 h-24 mb-6 rounded-2xl overflow-hidden shadow-lg border border-zinc-800 bg-black flex items-center justify-center">
                        <Image
                            src="/icons/aerowash/icon-192x192.png"
                            alt="AeroWash"
                            width={96}
                            height={96}
                            priority
                            className="object-contain"
                        />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                        AeroWash Operations
                    </h1>
                    <p className="text-sm text-zinc-400 mb-6">
                        Drone-powered exterior cleaning & workspace command center.
                    </p>

                    <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 mb-6 text-left">
                        <p className="font-semibold text-zinc-200 mb-1">📱 Install on Phone:</p>
                        <p>Tap your browser menu (<strong className="text-zinc-200">⋮</strong> on Android or <strong className="text-zinc-200">Share</strong> on iPhone) and select <strong className="text-orange-400">&ldquo;Add to Home Screen&rdquo;</strong> to install the standalone AeroWash app.</p>
                    </div>

                    <Link
                        href="/login?returnTo=/app/aerowash"
                        className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-orange-600/25"
                    >
                        <LogIn className="w-4 h-4" />
                        <span>Sign In to AeroWash</span>
                    </Link>
                </div>
            </div>
        )
    }

    const hasAccess = await canUserAccessWorkspace(user, "aerowash")

    if (!hasAccess) {
        const hasLRAccess = await canUserAccessWorkspace(user, "lrbuilders")
        return (
            <WorkspaceAccessDenied
                workspaceName="AeroWash"
                userEmail={user.email || ""}
                alternativeWorkspaceHref={hasLRAccess ? "/app/lrbuilders" : undefined}
                alternativeWorkspaceName={hasLRAccess ? "LR Builders" : undefined}
            />
        )
    }

    // User is authorized for AeroWash - enter workspace directly (stateless)
    redirect("/app/aerowash/dashboard")
}
