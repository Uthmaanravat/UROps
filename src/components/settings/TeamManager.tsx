'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
    createInviteAction,
    revokeInviteAction,
    updateUserRoleAction,
    removeUserAction,
    transferOwnershipAction,
    updateUserNotificationEmailAction
} from "@/app/(dashboard)/settings/team/actions"
import { Role } from "@prisma/client"
import {
    UserPlus,
    Shield,
    UserCheck,
    Trash2,
    Copy,
    Check,
    AlertCircle,
    Clock,
    History,
    ShieldAlert,
    ExternalLink
} from "lucide-react"

interface UserItem {
    id: string
    name: string | null
    email: string
    notificationEmail?: string | null
    isOwner?: boolean
    role: Role
    createdAt: Date
}

interface InvitationItem {
    id: string
    email: string
    role: Role
    expiresAt: Date
    createdAt: Date
    status: string
}

interface AuditLogItem {
    id: string
    actorUserId: string | null
    actorName: string | null
    action: string
    targetUserId: string | null
    targetEmail: string | null
    details: any
    createdAt: Date
}

interface TeamManagerProps {
    users: UserItem[]
    invitations: InvitationItem[]
    auditLogs: AuditLogItem[]
    currentUserId: string
}

export function TeamManager({
    users: initialUsers,
    invitations: initialInvitations,
    auditLogs: initialAuditLogs,
    currentUserId
}: TeamManagerProps) {
    const router = useRouter()
    const [users, setUsers] = useState<UserItem[]>(initialUsers)
    const [invitations, setInvitations] = useState<InvitationItem[]>(initialInvitations)
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(initialAuditLogs)

    // Invite Modal state
    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviteEmail, setInviteEmail] = useState("")
    const [inviteRole, setInviteRole] = useState<Role>(Role.MANAGER)
    const [inviteLoading, setInviteLoading] = useState(false)
    const [inviteError, setInviteError] = useState<string | null>(null)
    const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Action loading states
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [editingNotificationUserId, setEditingNotificationUserId] = useState<string | null>(null);
    const [notificationEmailInput, setNotificationEmailInput] = useState<string>("");
    const [savingNotification, setSavingNotification] = useState<boolean>(false);

    const handleSaveNotificationEmail = async (userId: string) => {
        try {
            setSavingNotification(true);
            await updateUserNotificationEmailAction(userId, notificationEmailInput);
            router.refresh();
            setEditingNotificationUserId(null);
        } catch (e: any) {
            alert(e?.message || "Failed to update notification email");
        } finally {
            setSavingNotification(false);
        }
    };

    const [globalError, setGlobalError] = useState<string | null>(null)

    const adminCount = users.filter(u => u.role === Role.ADMIN).length

    const handleCreateInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setInviteLoading(true)
        setInviteError(null)

        try {
            const res = await createInviteAction({ email: inviteEmail, role: inviteRole })
            if (res.success && res.inviteLink) {
                setCreatedInviteLink(res.inviteLink)
                router.refresh()
            } else {
                setInviteError(res.error || "Failed to create invitation.")
            }
        } catch (err: any) {
            setInviteError(err.message || "An unexpected error occurred.")
        } finally {
            setInviteLoading(false)
        }
    }

    const handleRevokeInvite = async (inviteId: string) => {
        if (!confirm("Are you sure you want to revoke this invitation?")) return
        setActionLoading(inviteId)
        setGlobalError(null)

        try {
            const res = await revokeInviteAction(inviteId)
            if (res.success) {
                setInvitations(prev => prev.filter(i => i.id !== inviteId))
                router.refresh()
            } else {
                setGlobalError(res.error || "Failed to revoke invitation.")
            }
        } catch (err: any) {
            setGlobalError(err.message)
        } finally {
            setActionLoading(null)
        }
    }

    const handleRoleChange = async (targetUserId: string, newRole: Role) => {
        setActionLoading(targetUserId)
        setGlobalError(null)

        try {
            const res = await updateUserRoleAction(targetUserId, newRole)
            if (res.success) {
                setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u))
                router.refresh()
            } else {
                setGlobalError(res.error || "Failed to update role.")
            }
        } catch (err: any) {
            setGlobalError(err.message)
        } finally {
            setActionLoading(null)
        }
    }

    const handleRemoveUser = async (targetUserId: string, targetName: string) => {
        const isSelf = targetUserId === currentUserId
        const msg = isSelf
            ? "Are you sure you want to remove yourself from this company? You will immediately lose access to this company workspace."
            : `Are you sure you want to remove ${targetName} from this company? All company quotes, invoices, and projects created by them will be preserved.`

        if (!confirm(msg)) return

        setActionLoading(targetUserId)
        setGlobalError(null)

        try {
            const res = await removeUserAction(targetUserId)
            if (res.success) {
                if (res.selfRemoved) {
                    window.location.href = "/login"
                } else {
                    setUsers(prev => prev.filter(u => u.id !== targetUserId))
                    router.refresh()
                }
            } else {
                setGlobalError(res.error || "Failed to remove user.")
            }
        } catch (err: any) {
            setGlobalError(err.message)
        } finally {
            setActionLoading(null)
        }
    }

    const handleTransferOwnership = async (targetUserId: string, targetName: string) => {
        if (!confirm(`Transfer ownership to ${targetName}? They will be promoted to Administrator.`)) return

        setActionLoading(targetUserId)
        setGlobalError(null)

        try {
            const res = await transferOwnershipAction(targetUserId)
            if (res.success) {
                setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: Role.ADMIN } : u))
                router.refresh()
            } else {
                setGlobalError(res.error || "Failed to transfer ownership.")
            }
        } catch (err: any) {
            setGlobalError(err.message)
        } finally {
            setActionLoading(null)
        }
    }

    const copyInviteLink = () => {
        if (!createdInviteLink) return
        navigator.clipboard.writeText(createdInviteLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-8">
            {globalError && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{globalError}</span>
                </div>
            )}

            {/* Top Bar with Invite Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Active Team Members</h2>
                    <p className="text-xs text-muted-foreground">
                        {users.length} active member{users.length === 1 ? '' : 's'} · {adminCount} administrator{adminCount === 1 ? '' : 's'}
                    </p>
                </div>

                <Dialog open={inviteOpen} onOpenChange={(open) => {
                    setInviteOpen(open)
                    if (!open) {
                        setCreatedInviteLink(null)
                        setInviteEmail("")
                        setInviteError(null)
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="font-semibold bg-primary text-black hover:bg-primary/90 flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            Invite Member
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-card border-white/10">
                        <DialogHeader>
                            <DialogTitle>Invite New Member</DialogTitle>
                            <DialogDescription>
                                Generate a single-use, 7-day secure invitation link. Public sign-up is disabled.
                            </DialogDescription>
                        </DialogHeader>

                        {createdInviteLink ? (
                            <div className="space-y-4 py-2">
                                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 shrink-0" />
                                    <span>Invitation link generated successfully! Send this URL to the invitee:</span>
                                </div>

                                <div className="p-2.5 rounded-md bg-black/60 border border-white/10 text-xs font-mono break-all select-all flex items-center justify-between gap-2">
                                    <span className="truncate">{createdInviteLink}</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 shrink-0 hover:bg-white/10"
                                        onClick={copyInviteLink}
                                    >
                                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        className="w-full"
                                        onClick={() => {
                                            setInviteOpen(false)
                                            setCreatedInviteLink(null)
                                            setInviteEmail("")
                                        }}
                                    >
                                        Done
                                    </Button>
                                </DialogFooter>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateInvite} className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label htmlFor="inviteEmail">Invitee Email Address</Label>
                                    <Input
                                        id="inviteEmail"
                                        type="email"
                                        placeholder="colleague@example.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="inviteRole">Assigned Role</Label>
                                    <select
                                        id="inviteRole"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as Role)}
                                    >
                                        <option value={Role.MANAGER}>Project Manager (Standard Member)</option>
                                        <option value={Role.ADMIN}>Administrator (Full Access &amp; Team Management)</option>
                                    </select>
                                    <p className="text-[11px] text-muted-foreground">
                                        The user will automatically be assigned this role upon accepting the invitation.
                                    </p>
                                </div>

                                {inviteError && (
                                    <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                                        {inviteError}
                                    </div>
                                )}

                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={inviteLoading} className="font-semibold">
                                        {inviteLoading ? "Generating..." : "Generate Invitation"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            {/* Team Members List */}
            <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="divide-y divide-white/5">
                    {users.map((user) => {
                        const isSelf = user.id === currentUserId
                        const isOnlyAdmin = user.role === Role.ADMIN && adminCount <= 1

                        return (
                            <div key={user.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm uppercase text-primary">
                                        {(user.name || user.email)[0]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{user.name || "Unnamed Member"}</span>
                                            {isSelf && (
                                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                                                    You
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>Login: <strong className="text-white">{user.email}</strong></span>
                                                {user.isOwner && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">OWNER</span>
                                                )}
                                                <span>•</span>
                                                <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs flex-wrap">
                                                <span className="text-gray-400">Notification email:</span>
                                                {editingNotificationUserId === user.id ? (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <Input
                                                            type="email"
                                                            value={notificationEmailInput}
                                                            onChange={(e) => setNotificationEmailInput(e.target.value)}
                                                            placeholder={user.email}
                                                            className="h-7 text-xs w-56 bg-white/5 border-white/20"
                                                        />
                                                        <Button
                                                            size="sm"
                                                            disabled={savingNotification}
                                                            onClick={() => handleSaveNotificationEmail(user.id)}
                                                            className="h-7 px-2.5 text-xs font-bold bg-primary text-black"
                                                        >
                                                            {savingNotification ? "..." : "Save"}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingNotificationUserId(null)}
                                                            className="h-7 px-2 text-xs text-gray-400"
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <strong className={user.notificationEmail ? "text-amber-300" : "text-gray-300 font-normal"}>
                                                            {user.notificationEmail ? user.notificationEmail : `${user.email} (default)`}
                                                        </strong>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingNotificationUserId(user.id);
                                                                setNotificationEmailInput(user.notificationEmail || "");
                                                            }}
                                                            className="text-[10px] text-primary hover:underline font-bold"
                                                        >
                                                            [Edit]
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                    <Badge
                                        variant="outline"
                                        className={user.role === Role.ADMIN ? "border-primary/50 text-primary uppercase text-[10px]" : "border-white/20 text-muted-foreground uppercase text-[10px]"}
                                    >
                                        {user.role}
                                    </Badge>

                                    {/* Role toggle button */}
                                    {user.role === Role.MANAGER ? (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-xs h-8 text-primary hover:text-primary hover:bg-primary/10"
                                            disabled={actionLoading === user.id}
                                            onClick={() => handleRoleChange(user.id, Role.ADMIN)}
                                        >
                                            Promote to Admin
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-xs h-8 text-muted-foreground hover:text-white"
                                            disabled={isOnlyAdmin || actionLoading === user.id}
                                            title={isOnlyAdmin ? "Cannot demote the last admin" : "Demote to Manager"}
                                            onClick={() => handleRoleChange(user.id, Role.MANAGER)}
                                        >
                                            Demote to Manager
                                        </Button>
                                    )}

                                    {/* Remove user button */}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs h-8 text-destructive hover:bg-destructive/10"
                                        disabled={isOnlyAdmin || actionLoading === user.id}
                                        title={isOnlyAdmin ? "Cannot remove the last admin" : isSelf ? "Leave company" : "Remove user"}
                                        onClick={() => handleRemoveUser(user.id, user.name || user.email)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        {isSelf ? "Leave" : "Remove"}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Pending Invitations Section */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-bold tracking-tight">Pending Invitations</h3>
                    <p className="text-xs text-muted-foreground">
                        Invitations expire 7 days after creation. Once accepted, the link becomes invalid.
                    </p>
                </div>

                {invitations.length === 0 ? (
                    <div className="p-6 rounded-xl border border-white/5 bg-black/20 text-center text-xs text-muted-foreground">
                        No pending invitations.
                    </div>
                ) : (
                    <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                        <div className="divide-y divide-white/5">
                            {invitations.map((inv) => (
                                <div key={inv.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm text-white">{inv.email}</span>
                                            <Badge variant="outline" className="text-[10px] uppercase border-white/20">
                                                {inv.role}
                                            </Badge>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                            <Clock className="h-3 w-3" />
                                            <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs h-8 text-destructive hover:bg-destructive/10 self-end sm:self-center"
                                        disabled={actionLoading === inv.id}
                                        onClick={() => handleRevokeInvite(inv.id)}
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Audit Log Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <h3 className="text-lg font-bold tracking-tight">Company Team Audit Log</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                    Chronological record of invitations, role changes, and member departures for compliance and security.
                </p>

                {auditLogs.length === 0 ? (
                    <div className="p-6 rounded-xl border border-white/5 bg-black/20 text-center text-xs text-muted-foreground">
                        No team activity recorded yet.
                    </div>
                ) : (
                    <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                            {auditLogs.map((log) => {
                                let label = log.action
                                if (log.action === 'INVITE_CREATED') label = `Invited ${log.targetEmail || 'user'} as ${log.details?.role || 'member'}`
                                if (log.action === 'INVITE_REVOKED') label = `Revoked invitation for ${log.targetEmail || 'user'}`
                                if (log.action === 'USER_JOINED') label = `${log.actorName || log.targetEmail} accepted invitation and joined as ${log.details?.role || 'member'}`
                                if (log.action === 'ROLE_UPDATED') label = `Updated ${log.targetEmail || 'user'}'s role to ${log.details?.newRole}`
                                if (log.action === 'USER_REMOVED') label = `Removed ${log.targetEmail || 'user'} from company`
                                if (log.action === 'OWNERSHIP_TRANSFERRED') label = `Transferred company ownership to ${log.targetEmail}`

                                return (
                                    <div key={log.id} className="p-3 text-xs flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <p className="font-medium text-white">{label}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                Actor: {log.actorName || log.actorUserId || 'System'}
                                            </p>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
