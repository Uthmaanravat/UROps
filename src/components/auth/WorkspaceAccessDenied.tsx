"use client"

import React, { useTransition } from "react"
import Link from "next/link"
import { ShieldAlert, ArrowRight, LogOut, Loader2 } from "lucide-react"
import { signOutAction } from "@/app/actions/auth"

interface WorkspaceAccessDeniedProps {
    workspaceName: "AeroWash" | "LR Builders"
    userEmail: string
    alternativeWorkspaceHref?: string
    alternativeWorkspaceName?: string
}

export default function WorkspaceAccessDenied({
    workspaceName,
    userEmail,
    alternativeWorkspaceHref,
    alternativeWorkspaceName,
}: WorkspaceAccessDeniedProps) {
    const [isPending, startTransition] = useTransition()

    const handleSignOut = () => {
        startTransition(async () => {
            await signOutAction()
        })
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
            <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                    Access Denied
                </h1>

                <p className="text-sm text-zinc-400 mb-6">
                    You do not have access to the <strong className="text-zinc-200">{workspaceName}</strong> workspace.
                </p>

                <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800 text-xs text-zinc-400 mb-6 break-all">
                    Signed in as: <span className="font-semibold text-zinc-200">{userEmail}</span>
                </div>

                <p className="text-xs text-zinc-500 mb-6">
                    This workspace is restricted to authorized team members and operations staff.
                </p>

                <div className="flex flex-col gap-3">
                    {alternativeWorkspaceHref && alternativeWorkspaceName && (
                        <Link
                            href={alternativeWorkspaceHref}
                            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition-colors shadow-lg shadow-orange-600/20"
                        >
                            <span>Open {alternativeWorkspaceName} Workspace</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isPending}
                        className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition-colors border border-zinc-700 disabled:opacity-50"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <LogOut className="w-4 h-4" />
                        )}
                        <span>Sign Out / Switch Account</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
