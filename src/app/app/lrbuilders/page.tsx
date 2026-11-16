import React from "react"
import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/auth-actions"
import {
    canUserAccessWorkspace,
    switchUserWorkspace,
    LRBUILDERS_COMPANY_ID,
} from "@/lib/workspace-auth"
import WorkspaceAccessDenied from "@/components/auth/WorkspaceAccessDenied"
import { LogIn } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "LR Builders",
    description: "LR Builders Project & Operations Command Center",
    manifest: "/manifest-lrbuilders.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "LR Builders",
    },
    icons: {
        apple: "/icons/lrbuilders/apple-touch-icon.png",
        icon: "/icons/lrbuilders/icon-512x512.png",
    },
}

export default async function LRBuildersAppPage() {
    const user = await getAuthUser()

    if (!user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center">
                    <div className="mx-auto w-24 h-24 mb-6 rounded-2xl overflow-hidden shadow-lg border border-zinc-700 bg-white flex items-center justify-center p-2">
                        <Image
                            src="/icons/lrbuilders/icon-192x192.png"
                            alt="LR Builders"
                            width={96}
                            height={96}
                            priority
                            className="object-contain"
                        />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                        LR Builders Operations
                    </h1>
                    <p className="text-sm text-zinc-400 mb-6">
                        Building, renovation & construction management command center.
                    </p>

                    <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 mb-6 text-left">
                        <p className="font-semibold text-zinc-200 mb-1">📱 Install on Phone:</p>
                        <p>Tap your browser menu (<strong className="text-zinc-200">⋮</strong> on Android or <strong className="text-zinc-200">Share</strong> on iPhone) and select <strong className="text-red-400">&ldquo;Add to Home Screen&rdquo;</strong> to install the standalone LR Builders app.</p>
                    </div>

                    <Link
                        href="/login?returnTo=/app/lrbuilders"
                        className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-red-600/25"
                    >
                        <LogIn className="w-4 h-4" />
                        <span>Sign In to LR Builders</span>
                    </Link>
                </div>
            </div>
        )
    }

    const hasAccess = await canUserAccessWorkspace(user, "lrbuilders")

    if (!hasAccess) {
        const hasAWAccess = await canUserAccessWorkspace(user, "aerowash")
        return (
            <WorkspaceAccessDenied
                workspaceName="LR Builders"
                userEmail={user.email || ""}
                alternativeWorkspaceHref={hasAWAccess ? "/app/aerowash" : undefined}
                alternativeWorkspaceName={hasAWAccess ? "AeroWash" : undefined}
            />
        )
    }

    // User is authorized for LR Builders - enter workspace directly (stateless)
    redirect("/app/lrbuilders/dashboard")
}
