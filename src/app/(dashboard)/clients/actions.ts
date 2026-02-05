'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createClient(formData: FormData) {
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
    const client = await prisma.client.create({ data })
    revalidatePath('/clients')
    redirect(`/clients/${client.id}`)
}

export async function updateClient(id: string, formData: FormData) {
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
        where: { id },
        data
    })
    revalidatePath(`/clients/${id}`)
    revalidatePath('/clients')
}

export async function deleteClientAction(id: string) {
    await prisma.client.delete({ where: { id } })
    revalidatePath('/clients')
}

export async function addInteractionAction(clientId: string, type: any, content: string) {
    await prisma.interaction.create({
        data: {
            clientId,
            type,
            content
        }
    })
    revalidatePath(`/clients/${clientId}`)
}

export async function markActivityReadAction(id: string) {
    await prisma.interaction.update({
        where: { id },
        data: { read: true }
    })
    revalidatePath(`/clients`) // Revalidate broadly to clear notifications
}
export async function updateClientJsonAction(id: string, data: any) {
    await prisma.client.update({
        where: { id },
        data
    })
    revalidatePath(`/work-breakdown-pricing`)
    revalidatePath(`/clients/${id}`)
}

export async function getClientsAction() {
    return await prisma.client.findMany({
        orderBy: { name: 'asc' }
    })
}
