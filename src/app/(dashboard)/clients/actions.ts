'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ensureAuth } from "@/lib/auth-actions"

export async function createClient(formData: FormData) {
    const companyId = await ensureAuth()
    const data = {
        companyId,
        name: formData.get('name') as string,
        companyName: formData.get('companyName') as string,
        attentionTo: formData.get('attentionTo') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        vatNumber: formData.get('vatNumber') as string,
        registrationNumber: formData.get('registrationNumber') as string,
        vendorNumber: formData.get('vendorNumber') as string,
        notes: formData.get('notes') as string,
    }
    const client = await prisma.client.create({ data })
    revalidatePath('/clients')
    redirect(`/clients/${client.id}`)
}

export async function updateClient(id: string, formData: FormData) {
    const companyId = await ensureAuth()
    const data = {
        name: formData.get('name') as string,
        companyName: formData.get('companyName') as string,
        attentionTo: formData.get('attentionTo') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        vatNumber: formData.get('vatNumber') as string,
        registrationNumber: formData.get('registrationNumber') as string,
        vendorNumber: formData.get('vendorNumber') as string,
        notes: formData.get('notes') as string,
    }
    await prisma.client.update({
        where: { id, companyId },
        data
    })
    revalidatePath(`/clients/${id}`)
    revalidatePath('/clients')
}

export async function deleteClientAction(id: string) {
    const companyId = await ensureAuth()
    await prisma.client.delete({ where: { id, companyId } })
    revalidatePath('/clients')
}

export async function addInteractionAction(clientId: string, type: any, content: string) {
    const companyId = await ensureAuth()
    // Verify client belongs to company
    const client = await prisma.client.findUnique({
        where: { id: clientId, companyId }
    })
    if (!client) throw new Error("Client not found")

    await prisma.interaction.create({
        data: {
            companyId,
            clientId,
            type,
            content
        }
    })
    revalidatePath(`/clients/${clientId}`)
}

export async function markActivityReadAction(id: string) {
    const companyId = await ensureAuth()
    // We can't filter Interaction directly by companyId easily without join, 
    // but we can check if it belongs to a client of this company
    const interaction = await prisma.interaction.findUnique({
        where: { id },
        include: { client: true }
    })

    if (interaction?.client.companyId !== companyId) {
        throw new Error("Access denied")
    }

    await prisma.interaction.update({
        where: { id },
        data: { read: true }
    })
    revalidatePath(`/clients`) // Revalidate broadly to clear notifications
}
export async function updateClientJsonAction(id: string, data: any) {
    const companyId = await ensureAuth()
    await prisma.client.update({
        where: { id, companyId },
        data
    })
    revalidatePath(`/work-breakdown-pricing`)
    revalidatePath(`/clients/${id}`)
}

export async function getClientsAction() {
    const companyId = await ensureAuth()
    return await prisma.client.findMany({
        where: { companyId },
        orderBy: { name: 'asc' }
    })
}
