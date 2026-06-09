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
        codePrefix: (formData.get('codePrefix') as string || "").toUpperCase() || null,
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
        codePrefix: (formData.get('codePrefix') as string || "").toUpperCase() || null,
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
        include: { contacts: true },
        orderBy: { name: 'asc' }
    })
}

export async function createClientContactAction(data: {
    clientId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
}) {
    const companyId = await ensureAuth()
    const client = await prisma.client.findFirst({
        where: { id: data.clientId, companyId }
    })
    if (!client) throw new Error("Client not found")

    const contact = await prisma.clientContact.create({
        data: {
            clientId: data.clientId,
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            role: data.role || null
        }
    })

    revalidatePath(`/clients/${data.clientId}`)
    return contact;
}

export async function updateClientContactAction(data: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
}) {
    const companyId = await ensureAuth()
    const contact = await prisma.clientContact.findUnique({
        where: { id: data.id },
        include: { client: true }
    })
    if (!contact || contact.client.companyId !== companyId) {
        throw new Error("Access denied")
    }

    const updated = await prisma.clientContact.update({
        where: { id: data.id },
        data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            role: data.role || null
        }
    })

    revalidatePath(`/clients/${contact.clientId}`)
    return updated;
}

export async function deleteClientContactAction(id: string) {
    const companyId = await ensureAuth()
    const contact = await prisma.clientContact.findUnique({
        where: { id },
        include: { client: true }
    })
    if (!contact || contact.client.companyId !== companyId) {
        throw new Error("Access denied")
    }

    await prisma.clientContact.delete({
        where: { id }
    })

    revalidatePath(`/clients/${contact.clientId}`)
    return { success: true };
}

export async function getClientContactsAction(clientId: string) {
    const companyId = await ensureAuth()
    const client = await prisma.client.findFirst({
        where: { id: clientId, companyId }
    })
    if (!client) throw new Error("Client not found")

    return await prisma.clientContact.findMany({
        where: { clientId },
        orderBy: { name: 'asc' }
    })
}
