'use server'

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

export async function updateUserRoleAction(targetUserId: string, newRole: Role) {
    const { updateUserRoleAction: updateRole } = await import("@/app/(dashboard)/settings/team/actions")
    return await updateRole(targetUserId, newRole)
}

export async function validateInviteTokenAction(rawToken: string) {
    if (!rawToken || typeof rawToken !== 'string') {
        return { valid: false, error: "No invitation token provided." }
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex')
    const invite = await prisma.invitation.findUnique({
        where: { tokenHash },
        include: { company: { select: { name: true } } }
    })
    if (!invite || invite.status !== 'PENDING') {
        return { valid: false, error: "This invitation is invalid or has already been used." }
    }
    if (invite.expiresAt < new Date()) {
        return { valid: false, error: "This invitation has expired (valid for 7 days)." }
    }
    return {
        valid: true,
        email: invite.email.trim().toLowerCase(),
        companyName: invite.company.name,
        role: invite.role
    }
}

export async function signUpAction(formData: FormData) {
    const token = formData.get("token") as string
    const password = formData.get("password") as string
    const name = formData.get("name") as string

    if (!token) {
        return { success: false, error: "Sign-up is by invitation only. A valid invitation token is required." }
    }
    if (!password || password.length < 6) {
        return { success: false, error: "Password must be at least 6 characters." }
    }
    if (!name || !name.trim()) {
        return { success: false, error: "Full name is required." }
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex')
        const invite = await prisma.invitation.findUnique({
            where: { tokenHash },
            include: { company: true }
        })

        if (!invite || invite.status !== 'PENDING') {
            return { success: false, error: "This invitation is invalid or has already been used." }
        }
        if (invite.expiresAt < new Date()) {
            return { success: false, error: "This invitation has expired." }
        }

        const supabase = createClient()
        const targetEmail = invite.email.trim().toLowerCase()

        // Create user in Supabase Auth with the invited email and invite role
        const { data, error } = await supabase.auth.signUp({
            email: targetEmail,
            password,
            options: {
                data: {
                    full_name: name.trim(),
                    role: invite.role
                },
                emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/callback`,
            },
        })

        if (error) throw error
        if (!data.user) {
            throw new Error("Failed to create authentication user.")
        }

        // Atomically create User record, mark Invitation as ACCEPTED, and create Audit Log
        await prisma.$transaction(async (tx) => {
            await tx.user.upsert({
                where: { id: data.user!.id },
                update: {
                    email: targetEmail,
                    name: name.trim(),
                    role: invite.role,
                    companyId: invite.companyId
                },
                create: {
                    id: data.user!.id,
                    email: targetEmail,
                    name: name.trim(),
                    role: invite.role,
                    companyId: invite.companyId
                }
            })

            await tx.invitation.update({
                where: { id: invite.id },
                data: {
                    status: 'ACCEPTED',
                    usedAt: new Date()
                }
            })

            await tx.companyAuditLog.create({
                data: {
                    companyId: invite.companyId,
                    actorUserId: data.user!.id,
                    actorName: name.trim(),
                    action: 'USER_JOINED',
                    targetUserId: data.user!.id,
                    targetEmail: targetEmail,
                    details: { role: invite.role }
                }
            })
        })

        return { success: true }
    } catch (error: any) {
        console.error("SignUp Error:", error.message)
        return { success: false, error: error.message }
    }
}

export async function signInAction(formData: FormData) {
    const email = (formData.get("email") as string)?.trim().toLowerCase()
    const password = formData.get("password") as string

    const supabase = createClient()

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) throw error

        if (data?.user) {
            // Verify user belongs to an active company in Prisma
            const targetEmail = (data.user.email || email).trim().toLowerCase()
            const dbUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { id: data.user.id },
                        { email: { equals: targetEmail, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, companyId: true, role: true }
            })

            if (!dbUser || !dbUser.companyId) {
                await supabase.auth.signOut()
                return {
                    success: false,
                    error: "Access denied. Your account is not associated with an active company or has been removed."
                }
            }

            return {
                success: true,
                redirectTo: dbUser.role === 'CREW' ? '/my-jobs' : '/dashboard'
            }
        }

        return { success: true, redirectTo: '/dashboard' }
    } catch (error: any) {
        console.error("SignIn Error:", error.message)
        return { success: false, error: error.message }
    }
}

export async function signOutAction() {
    const supabase = createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    return { success: true }
}
