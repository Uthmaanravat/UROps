import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { InvoiceViewer } from "@/components/invoices/InvoiceViewer";
import { getCompanySettings } from "@/app/(dashboard)/settings/actions";
import { notFound } from "next/navigation";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth();
    const supabase = (await import("@/lib/supabase/server")).createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const dbUser = user ? await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, isOwner: true } }) : null;
    const isOwner = (dbUser as any)?.isOwner === true;
    const isAdmin = dbUser?.role === 'ADMIN';

    const [invoice, companySettings, projects, tenders, termsTemplates] = await Promise.all([
        prisma.invoice.findFirst({
            where: { id: params.id, companyId },
            include: {
                client: {
                    include: {
                        contacts: true
                    }
                },
                items: {
                    orderBy: { position: 'asc' }
                },
                payments: true,
                tender: true,
                creditNotes: {
                    orderBy: { createdAt: 'desc' }
                },
                unlockLogs: {
                    orderBy: { createdAt: 'desc' }
                },
                terms: {
                    orderBy: { position: 'asc' },
                    include: { template: true }
                },
                project: {
                    include: {
                        invoices: {
                            select: { id: true, number: true, quoteNumber: true, type: true, status: true, date: true }
                        }
                    }
                }
            } as any
        }),
        getCompanySettings(),
        prisma.project.findMany({
            where: { companyId },
            orderBy: { name: 'asc' }
        }),
        prisma.tender.findMany({
            where: { companyId },
            include: { client: true },
            orderBy: { createdAt: 'asc' }
        }),
        prisma.termsTemplate.findMany({
            where: { companyId },
            orderBy: [
                { isDefault: 'desc' },
                { name: 'asc' }
            ]
        })
    ]);

    if (!invoice) {
        notFound();
    }

    if ((invoice as any).metadata?.siteVisitPhotos && Array.isArray((invoice as any).metadata.siteVisitPhotos)) {
        const { resolvePhotoUrls } = await import("@/lib/supabase-storage");
        (invoice as any).metadata.siteVisitPhotos = await resolvePhotoUrls((invoice as any).metadata.siteVisitPhotos);
    }

    const isTendersEnabled = companySettings?.tendersEnabled === true;

    const prospectId = ((invoice as any)?.client?.customFields as any)?.prospectId;
    const linkedProspect = prospectId
        ? await prisma.prospect.findUnique({ where: { id: prospectId } })
        : await prisma.prospect.findFirst({
            where: { companyId, name: { equals: (invoice as any)?.client?.name || '', mode: 'insensitive' } }
        });

    return (
        <div className="space-y-6">
            {linkedProspect && (
                <div className="flex justify-end">
                    <Link
                        href={`/drone?prospectId=${linkedProspect.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                    >
                        <span>🎯 Origin: Core Target / Prospect &quot;{linkedProspect.name}&quot;</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            )}
            <InvoiceViewer
                invoice={invoice}
                companySettings={companySettings}
                availableProjects={projects as any[]}
                tenders={isTendersEnabled ? (tenders as any[]) : []}
                termsTemplates={termsTemplates as any[]}
                isAdmin={isAdmin}
                isOwner={isOwner}
                currentUserEmail={user?.email || ''}
            />
        </div>
    )
}
