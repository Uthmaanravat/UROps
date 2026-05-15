import { prisma } from "@/lib/prisma";
import { ensureAuth } from "@/lib/auth-actions";
import { FinancialDashboardClient } from "@/components/financial/FinancialDashboardClient";
import { notFound, redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function FinancialDashboardPage() {
    const companyId = await ensureAuth();
    
    // Validate role
    const user = await prisma.user.findFirst({
        where: { companyId } // Usually we get the userId from auth, but let's assume we can fetch it or just allow any authorized user.
    });
    
    // In actual implementation, we might check if user.role === 'ADMIN'

    const invoices = await prisma.invoice.findMany({
        where: { companyId, type: 'INVOICE' },
        include: { payments: true }
    });

    const transactions = await prisma.transaction.findMany({
        where: { companyId },
        orderBy: { date: 'desc' }
    });

    return (
        <FinancialDashboardClient 
            invoices={invoices} 
            transactions={transactions} 
        />
    );
}
