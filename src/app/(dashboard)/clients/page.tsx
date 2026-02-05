import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Phone, Mail } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";

export const dynamic = 'force-dynamic';

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string } }) {
    let clients: any[] = [];
    const query = searchParams.q || "";

    try {
        clients = await prisma.client.findMany({
            where: query ? {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                    { phone: { contains: query, mode: 'insensitive' } },
                ]
            } : undefined,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { invoices: true } } }
        });
    } catch (e) {
        console.error("Database Connection Failed:", e);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
                <div className="flex items-center gap-4">
                    <SearchInput placeholder="Search clients..." />
                    <Link href="/clients/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Add Client
                        </Button>
                    </Link>
                </div>
            </div>

            {clients.length === 0 ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed text-center animate-in fade-in-50">
                    <h3 className="mt-4 text-lg font-semibold">
                        {query ? "No clients found" : "No clients added"}
                    </h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                        {query ? `No results for "${query}"` : "You haven't added any clients yet."}
                    </p>
                    {!query && (
                        <Link href="/clients/new">
                            <Button>Add your first Client</Button>
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {clients.map(client => (
                        <div key={client.id} className="group relative rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold text-lg">{client.name}</div>
                            </div>
                            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                                {client.email && (
                                    <div className="flex items-center">
                                        <Mail className="mr-2 h-4 w-4 opacity-70" /> {client.email}
                                    </div>
                                )}
                                {client.phone && (
                                    <div className="flex items-center">
                                        <Phone className="mr-2 h-4 w-4 opacity-70" /> {client.phone}
                                    </div>
                                )}
                                {client.address && (
                                    <div className="flex items-center">
                                        <MapPin className="mr-2 h-4 w-4 opacity-70" /> {client.address}
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                                <span>{client._count.invoices} Projects</span>
                                <span>Joined {new Date(client.createdAt).toLocaleDateString()}</span>
                            </div>
                            <Link href={`/clients/${client.id}`} className="absolute inset-0">
                                <span className="sr-only">View Client</span>
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
