'use server'

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import { ensureAuth } from "@/lib/auth-actions"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

async function getCallerAdmin(companyId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized: No active session")

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true, role: true, companyId: true }
    })

    if (!dbUser || dbUser.companyId !== companyId) {
        throw new Error("Unauthorized: Not a member of this company")
    }
    if (dbUser.role !== Role.ADMIN) {
        throw new Error("Unauthorized: Only administrators can manage team members")
    }

    return dbUser
}

export async function getTeamDataAction() {
    const companyId = await ensureAuth()
    const caller = await getCallerAdmin(companyId)

    const [users, invitations, auditLogs] = await Promise.all([
        prisma.user.findMany({
            where: { companyId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isOwner: true,
                notificationEmail: true,
                createdAt: true
            },
            orderBy: { createdAt: 'asc' }
        }),
        prisma.invitation.findMany({
            where: { companyId, status: 'PENDING' },
            select: {
                id: true,
                email: true,
                role: true,
                expiresAt: true,
                createdAt: true,
                status: true
            },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.companyAuditLog.findMany({
            where: { companyId },
            select: {
                id: true,
                actorUserId: true,
                actorName: true,
                action: true,
                targetUserId: true,
                targetEmail: true,
                details: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        })
    ])

    return {
        users,
        invitations,
        auditLogs,
        currentUserId: caller.id
    }
}

export async function createInviteAction(data: { email: string; role: Role }) {
    const companyId = await ensureAuth()
    const caller = await getCallerAdmin(companyId)

    const email = data.email?.trim().toLowerCase()
    if (!email || !email.includes('@')) {
        return { success: false, error: "A valid email address is required." }
    }

    const role = data.role === Role.ADMIN ? Role.ADMIN : Role.MANAGER

    // Check if user already exists in this company (case-insensitive match)
    const existingMember = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, companyId }
    })
    if (existingMember) {
        return { success: false, error: "A team member with this email already belongs to this company." }
    }

    // Revoke any pending invites for this email in this company
    await prisma.invitation.updateMany({
        where: { companyId, email: { equals: email, mode: 'insensitive' }, status: 'PENDING' },
        data: { status: 'REVOKED' }
    })

    // Generate cryptographically secure token & SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invite = await prisma.invitation.create({
        data: {
            companyId,
            email,
            role,
            tokenHash,
            invitedByUserId: caller.id,
            expiresAt,
            status: 'PENDING'
        }
    })

    // Log the invite creation
    await prisma.companyAuditLog.create({
        data: {
            companyId,
            actorUserId: caller.id,
            actorName: caller.name || caller.email,
            action: 'INVITE_CREATED',
            targetEmail: email,
            details: { role, inviteId: invite.id }
        }
    })

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/signup?token=${rawToken}`

    revalidatePath('/settings/team')
    return { success: true, inviteLink }
}

export async function revokeInviteAction(inviteId: string) {
    const companyId = await ensureAuth()
    const caller = await getCallerAdmin(companyId)

    const invite = await prisma.invitation.findFirst({
        where: { id: inviteId, companyId }
    })
    if (!invite) {
        return { success: false, error: "Invitation not found or unauthorized." }
    }

    await prisma.invitation.update({
        where: { id: inviteId },
        data: { status: 'REVOKED' }
    })

    await prisma.companyAuditLog.create({
        data: {
            companyId,
            actorUserId: caller.id,
            actorName: caller.name || caller.email,
            action: 'INVITE_REVOKED',
            targetEmail: invite.email,
            details: { inviteId }
        }
    })

    revalidatePath('/settings/team')
    return { success: true }
}

export async function updateUserRoleAction(targetUserId: string, newRole: Role) {
    const companyId = await ensureAuth()
    const caller = await getCallerAdmin(companyId)

    const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, companyId }
    })
    if (!targetUser) {
        return { success: false, error: "Team member not found or unauthorized." }
    }

    // Guard: Prevent demoting the last administrator
    if (targetUser.role === Role.ADMIN && newRole !== Role.ADMIN) {
        const adminCount = await prisma.user.count({
            where: { companyId, role: Role.ADMIN }
        })
        if (adminCount <= 1) {
            return {
                success: false,
                error: "Cannot demote the last administrator. Promote another administrator or transfer ownership first."
            }
        }
    }

    await prisma.user.update({
        where: { id: targetUserId },
        data: { role: newRole }
    })

    await prisma.companyAuditLog.create({
        data: {
            companyId,
            actorUserId: caller.id,
            actorName: caller.name || caller.email,
            action: 'ROLE_UPDATED',
            targetUserId: targetUser.id,
            targetEmail: targetUser.email,
            details: { oldRole: targetUser.role, newRole }
        }
    })

    revalidatePath('/settings/team')
    return { success: true }
}

export async function removeUserAction(targetUserId: string) {
    const companyId = await ensureAuth()
    const caller = await getCallerAdmin(companyId)

    const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, companyId }
    })
    if (!targetUser) {
        return { success: false, error: "Team member not found or unauthorized." }
    }

    // Guard: Prevent removing the last administrator
    if (targetUser.role === Role.ADMIN) {
        const adminCount = await prisma.user.count({
            where: { companyId, role: Role.ADMIN }
        })
        if (adminCount <= 1) {
            return {
                success: false,
                error: "Cannot remove the last administrator of the company."
            }
        }
    }

    // Remove user record from Prisma. All created assets (quotes, invoices, projects, notes)
    // stay owned by companyId. Any name recorded on history records is preserved.
    await prisma.user.delete({
        where: { id: targetUserId }
    })

    // Log the user removal
    await prisma.companyAuditLog.create({
        data: {
            companyId,
            actorUserId: caller.id,
            actorName: caller.name || caller.email,
            action: 'USER_REMOVED',
            targetUserId: targetUser.id,
            targetEmail: targetUser.email,
            details: { role: targetUser.role }
        }
    })

    const isSelfRemoval = targetUserId === caller.id

    if (isSelfRemoval) {
        const supabase = createClient()
        await supabase.auth.signOut()
    }

    revalidatePath('/settings/team')
    return { success: true, selfRemoved: isSelfRemoval }
}

export async function transferOwnershipAction(targetUserId: string) {
    const companyId = await ensureAuth()
    const caller = await getCallerAdmin(companyId)

    const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, companyId }
    })
    if (!targetUser) {
        return { success: false, error: "Team member not found or unauthorized." }
    }

    // Ensure target user is ADMIN
    await prisma.user.update({
        where: { id: targetUserId },
        data: { role: Role.ADMIN }
    })

    await prisma.companyAuditLog.create({
        data: {
            companyId,
            actorUserId: caller.id,
            actorName: caller.name || caller.email,
            action: 'OWNERSHIP_TRANSFERRED',
            targetUserId: targetUser.id,
            targetEmail: targetUser.email,
            details: { newAdmin: targetUser.email }
        }
    })

    revalidatePath('/settings/team')
    return { success: true }
}

export async function updateUserNotificationEmailAction(userId: string, notificationEmail: string | null) {
    const companyId = await ensureAuth()
    const caller = await getCallerAdmin(companyId)

    const cleanEmail = notificationEmail?.trim() ? notificationEmail.trim() : null;
    if (cleanEmail && !cleanEmail.includes('@')) {
        throw new Error("Invalid email address format");
    }

    const updated = await prisma.user.update({
        where: { id: userId, companyId },
        data: { notificationEmail: cleanEmail }
    });

    try {
        await prisma.companyAuditLog.create({
            data: {
                companyId,
                actorUserId: caller.id,
                actorName: caller.name || caller.email,
                action: 'USER_UPDATED',
                targetUserId: userId,
                targetEmail: updated.email,
                details: { notificationEmail: cleanEmail }
            }
        });
    } catch (e) {
        // non-blocking audit log
    }

    revalidatePath('/settings/team');
    return { success: true, notificationEmail: cleanEmail };
}
