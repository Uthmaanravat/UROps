import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ensureAuth } from "@/lib/auth-actions"
import { updateProject } from "../../actions"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound, redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export const dynamic = 'force-dynamic'

export default async function EditProjectPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth()
    const project = await prisma.project.findUnique({
        where: { id: params.id, companyId },
        include: { client: true }
    })

    if (!project) notFound()

    const clients = await prisma.client.findMany({
        where: { companyId },
        orderBy: { name: 'asc' }
    })

    async function handleUpdate(formData: FormData) {
        'use server'
        const companyId = await ensureAuth()
        const name = formData.get('name') as string
        const clientId = formData.get('clientId') as string
        const description = formData.get('description') as string
        const startDate = formData.get('startDate') ? new Date(formData.get('startDate') as string) : null
        const endDate = formData.get('endDate') ? new Date(formData.get('endDate') as string) : null

        await prisma.project.update({
            where: { id: params.id, companyId },
            data: {
                name,
                clientId,
                description,
                startDate,
                endDate
            }
        })

        revalidatePath(`/projects/${params.id}`)
        revalidatePath('/projects')
        redirect(`/projects/${params.id}`)
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/projects/${params.id}`}>
                    <Button variant="ghost" size="icon" className="hover:bg-primary/10 text-primary">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Edit Project</h1>
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#1A1A2E] shadow-2xl p-8">
                <form action={handleUpdate} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project Name *</Label>
                        <Input
                            id="name"
                            name="name"
                            defaultValue={project.name}
                            className="bg-[#14141E] border-white/10 text-white font-bold h-12"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="clientId" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client *</Label>
                        <select
                            id="clientId"
                            name="clientId"
                            defaultValue={project.clientId}
                            className="flex h-12 w-full rounded-md border border-white/10 bg-[#14141E] px-3 py-2 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                            required
                        >
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.companyName || c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="startDate" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Start Date</Label>
                            <Input
                                id="startDate"
                                name="startDate"
                                type="date"
                                defaultValue={project.startDate ? project.startDate.toISOString().split('T')[0] : ""}
                                className="bg-[#14141E] border-white/10 text-white font-bold h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Completion</Label>
                            <Input
                                id="endDate"
                                name="endDate"
                                type="date"
                                defaultValue={project.endDate ? project.endDate.toISOString().split('T')[0] : ""}
                                className="bg-[#14141E] border-white/10 text-white font-bold h-12"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description & Notes</Label>
                        <Textarea
                            id="description"
                            name="description"
                            defaultValue={project.description || ""}
                            className="min-h-[120px] bg-[#14141E] border-white/10 text-white font-medium text-sm resize-none"
                            placeholder="Project goals, site specific info, or technical constraints..."
                        />
                    </div>

                    <div className="pt-6 flex justify-end gap-3 border-t border-white/5">
                        <Link href={`/projects/${params.id}`}>
                            <Button variant="ghost" type="button" className="font-bold text-muted-foreground hover:text-white">Cancel</Button>
                        </Link>
                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 h-12 shadow-xl shadow-primary/20 rounded-xl">
                            Save Project Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
