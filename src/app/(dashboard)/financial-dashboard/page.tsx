import { prisma } from "@/lib/prisma";
import { ensureAuth } from "@/lib/auth-actions";
import { FinancialDashboardClient } from "@/components/financial/FinancialDashboardClient";
import { notFound, redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function FinancialDashboardPage() {
    const companyId = await ensureAuth();
    
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { settings: true }
    });
    
    const businessName = company?.settings?.name || company?.name || "Your Company";

    const invoices = await prisma.invoice.findMany({
        where: { companyId, type: 'INVOICE' },
        include: { payments: true, client: true, project: true }
    });

    const transactions = await prisma.transaction.findMany({
        where: { companyId },
        orderBy: { date: 'desc' }
    });

    const projects = await prisma.project.findMany({
        where: { companyId },
        include: { client: true }
    });

    return (
        <FinancialDashboardClient 
            invoices={invoices} 
            transactions={transactions}
            projects={projects}
            businessName={businessName}
        />
    );
}
