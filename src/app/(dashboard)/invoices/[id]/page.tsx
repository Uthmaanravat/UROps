import { prisma } from "@/lib/prisma";
import { InvoiceViewer } from "@/components/invoices/InvoiceViewer";
import { getCompanySettings } from "@/app/(dashboard)/settings/actions";
import { notFound } from "next/navigation";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth();
    const [invoice, companySettings] = await Promise.all([
        prisma.invoice.findFirst({
            where: { id: params.id, companyId },
            include: {
                client: true,
                items: true,
                payments: true,
                project: true
            } as any
        }),
        getCompanySettings()
    ]);

    if (!invoice) {
        notFound();
    }

    // Pass plain object to client component if needed (dates might need converting to string if using simple components, but RSC handles Date objects to Client components in newer versions, usually serializable. Actually, Dates are serializable now).
    return (
        <div className="space-y-6">
            <InvoiceViewer invoice={invoice} companySettings={companySettings} />
        </div>
    )
}
