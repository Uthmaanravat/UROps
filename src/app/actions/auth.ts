'use server'

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import { revalidatePath } from "next/cache"

export async function signUpAction(formData: FormData) {
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const name = formData.get("name") as string
    const role = formData.get("role") as Role || Role.MANAGER

    const supabase = createClient()

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role: role,
                },
                emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/callback`,
            },
        })

        if (error) throw error

        if (data.user) {
            // Extract domain
            const domain = email.split("@")[1].toLowerCase()

            // Find or create company
            let company = await prisma.company.findUnique({
                where: { domain }
            })

            if (!company) {
                // Create company and default settings
                company = await prisma.company.create({
                    data: {
                        name: domain.split(".")[0].toUpperCase(), // Default name
                        domain,
                        settings: {
                            create: {
                                name: domain.split(".")[0].toUpperCase()
                            }
                        }
                    }
                })
            }

            // Create user in Prisma
            await prisma.user.upsert({
                where: { id: data.user.id },
                update: {
                    email,
                    name,
                    role,
                    company: { connect: { id: company.id } }
                },
                create: {
                    id: data.user.id,
                    email,
                    name,
                    role,
                    company: { connect: { id: company.id } }
                },
            })
        }

        return { success: true }
    } catch (error: any) {
        console.error("SignUp Error:", error.message)
        return { success: false, error: error.message }
    }
}

export async function signInAction(formData: FormData) {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const supabase = createClient()

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) throw error

        return { success: true }
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

export async function updateUserRoleAction(userId: string, role: Role) {
    await prisma.user.update({
        where: { id: userId },
        data: { role }
    })
    revalidatePath('/', 'layout')
    return { success: true }
}
