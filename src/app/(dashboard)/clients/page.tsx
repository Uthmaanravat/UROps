import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Phone, Mail } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string } }) {
    const companyId = await ensureAuth();
    let clients: any[] = [];
    const query = searchParams.q || "";

    try {
        clients = await prisma.client.findMany({
            where: {
                companyId,
                ...(query ? {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                        { phone: { contains: query, mode: 'insensitive' } },
                    ]
                } : {})
            },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { invoices: true } } }
        });
    } catch (e) {
        console.error("Database Connection Failed:", e);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Clients</h1>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">Manage your partners and customer base</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <SearchInput placeholder="Search clients..." className="w-full sm:w-64 bg-white/5 border-white/10 text-white" />
                    <Link href="/clients/new" className="w-full sm:w-auto">
                        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs tracking-widest h-11 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95">
                            <Plus className="mr-2 h-4 w-4" /> Add New Client
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
