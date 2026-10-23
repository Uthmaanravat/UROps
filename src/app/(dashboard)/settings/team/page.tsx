import { getTeamDataAction } from "./actions"
import { TeamManager } from "@/components/settings/TeamManager"
import Link from "next/link"
import { Building2, ShieldCheck, Users, ShieldAlert } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function TeamSettingsPage() {
    let teamData: any = null
    let error: string | null = null

    try {
        teamData = await getTeamDataAction()
    } catch (e: any) {
        error = e.message || "Failed to load team data"
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
                    <p className="text-muted-foreground text-sm">
                        Settings &gt; Team — Manage members, invite colleagues, and view audit history.
                    </p>
                </div>

                <div className="flex items-center gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
                    <Link
                        href="/settings"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        Company &amp; Branding
                    </Link>
                    <Link
                        href="/settings/terms"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                        <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
                        Quotation Terms
                    </Link>
                    <Link
                        href="/settings/team"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-black flex items-center gap-1.5 shadow-sm"
                    >
                        <Users className="h-3.5 w-3.5" />
                        Team
                    </Link>
                </div>
            </div>

            {error ? (
                <div className="p-8 rounded-2xl border border-destructive/20 bg-card text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <h2 className="text-lg font-bold">Access Restricted</h2>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        {error}. Only company administrators can view or modify team members.
                    </p>
                </div>
            ) : (
                <TeamManager
                    users={teamData.users}
                    invitations={teamData.invitations}
                    auditLogs={teamData.auditLogs}
                    currentUserId={teamData.currentUserId}
                />
            )}
        </div>
    )
}
