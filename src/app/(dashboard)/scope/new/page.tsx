import { prisma } from "@/lib/prisma"
import { ScopeEntryForm } from "@/components/scope/ScopeEntryForm"

export default async function NewScopePage() {
    const clients = await prisma.client.findMany({
        orderBy: { name: 'asc' }
    })

    return (
        <div className="max-w-4xl mx-auto py-6 px-4">
            <ScopeEntryForm clients={clients} />
        </div>
    )
}
