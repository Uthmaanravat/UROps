import { prisma } from "@/lib/prisma"
import { ScopeEntryForm } from "@/components/scope/ScopeEntryForm"
import { ensureAuth } from "@/lib/auth-actions"

export const dynamic = 'force-dynamic'

export default async function NewScopePage() {
    const companyId = await ensureAuth()
    const clients = await prisma.client.findMany({
        where: { companyId },
        orderBy: { name: 'asc' }
    })

    return (
        <div className="max-w-4xl mx-auto py-6 px-4">
            <ScopeEntryForm clients={clients} />
        </div>
    )
}
