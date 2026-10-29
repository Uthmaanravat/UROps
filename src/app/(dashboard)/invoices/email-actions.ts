'use server'

import { sendRealEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"

/**
 * Server-side gatekeeper:
 * Over-R50,000 quotes by non-owners must be blocked server-side from PDF download, email and share link until approved.
 */
export async function verifyQuoteActionPermission(invoiceId: string, actionType: 'DOWNLOAD_PDF' | 'EMAIL' | 'SHARE_LINK') {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            select: { id: true, total: true, subtotal: true, type: true, quoteNumber: true, companyId: true, metadata: true }
        });
        if (!invoice) return { allowed: false, error: "Invoice not found or unauthorized." };

        const isAW = invoice.quoteNumber?.startsWith('AW-') || invoice.companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
        const isOwner = authUser?.isOwner === true;
        const totalAmount = invoice.total || invoice.subtotal || 0;

        if (isAW && invoice.type === 'QUOTE' && totalAmount > 50000 && !isOwner) {
            const approvalStatus = (invoice.metadata as any)?.approvalStatus;
            if (approvalStatus !== 'APPROVED') {
                const actionLabel = actionType === 'DOWNLOAD_PDF' ? 'downloaded as PDF' : actionType === 'EMAIL' ? 'sent via email' : 'shared via link';
                return {
                    allowed: false,
                    error: `This quotation exceeds R50,000 and requires owner approval before it can be ${actionLabel}. Please request approval from the owner.`
                };
            }
        }

        return { allowed: true };
    } catch (e: any) {
        return { allowed: false, error: e.message || "Failed to verify quote permissions." };
    }
}

export async function sendInvoiceEmail(invoiceId: string, recipients?: string[], customBody?: string) {
    try {
        const companyId = await ensureAuth()
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { client: true, items: true }
        })

        if (!invoice) {
            return { success: false, error: "Invoice not found or unauthorized" }
        }

        // Server-side blocking: over R50,000 by non-owners requires owner approval
        const perm = await verifyQuoteActionPermission(invoiceId, 'EMAIL');
        if (!perm.allowed) {
            return { success: false, error: perm.error };
        }

        if (!invoice.items || invoice.items.length === 0) {
            return { success: false, error: "Cannot send document: Document has no line items." }
        }

        const invalidItems = invoice.items.filter(item => !item.quantity || Number(item.quantity) <= 0 || !item.unitPrice || Number(item.unitPrice) <= 0);
        if (invalidItems.length > 0) {
            return {
                success: false,
                error: `Cannot send document: ${invalidItems.length} line item(s) have zero or blank prices/quantities. Please review and price all items first.`
            }
        }

        const toEmails = recipients && recipients.length > 0 ? recipients : [invoice.client.email].filter(Boolean) as string[];

        if (toEmails.length === 0) {
            return { success: false, error: "No recipient emails provided" }
        }

        const isAW = invoice.quoteNumber?.startsWith('AW-') || invoice.companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
        const formattedNumber = invoice.quoteNumber || (invoice.type === 'QUOTE' ? `Q-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}` : `INV-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`);
        const docTypeLabel = invoice.type === 'QUOTE' ? (isAW ? 'Quotation' : 'Quote') : (isAW ? 'Tax Invoice' : 'Invoice');
        const subject = `${docTypeLabel} ${formattedNumber} from UROps`
        const body = customBody || `Hi ${invoice.client.name},

Please find attached your ${invoice.type.toLowerCase()} ${formattedNumber}.
Total Amount: R${invoice.total.toFixed(2)}

Best regards,
The UROps Team`

        const settings = await prisma.companySettings.findUnique({ where: { companyId: invoice.companyId } });
        const fromEmail = settings?.email || 'onboarding@resend.dev';
        const fromName = settings?.name || 'UROps';

        const formattedFrom = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;

        const result = await sendRealEmail({
            to: toEmails,
            subject,
            body: body,
            from: formattedFrom,
        })

        if (!result.success) {
            return { success: false, error: result.error || "Failed to send email" }
        }

        await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status
            }
        })

        return { success: true, messageId: (result as any).id || (result as any).data?.id }
    } catch (error: any) {
        console.error("sendInvoiceEmail error:", error)
        return { success: false, error: error.message || "Failed to send email" }
    }
}

export async function requestQuoteApprovalAction(invoiceId: string) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { client: true }
        });
        if (!invoice) return { success: false, error: "Invoice not found" };

        const currentMeta = (invoice.metadata as any) || {};
        const updatedMeta = {
            ...currentMeta,
            approvalStatus: 'PENDING',
            needsApproval: true,
            approvalRequestedAt: new Date().toISOString(),
            approvalRequestedBy: authUser?.name || authUser?.email || 'Admin User'
        };

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { metadata: updatedMeta }
        });

        // Dynamic Owner Lookup: Query all owners in the company using the isOwner flag
        const owners = await prisma.user.findMany({
            where: { companyId, isOwner: true },
            select: { email: true, name: true }
        });

        const ownerEmails = owners.map(o => o.email).filter(Boolean);
        if (ownerEmails.length === 0) {
            const settings = await prisma.companySettings.findUnique({ where: { companyId } });
            if (settings?.email) ownerEmails.push(settings.email);
        }

        const formattedNumber = invoice.quoteNumber || `AW-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app';
        const quoteUrl = `${appUrl}/invoices/${invoice.id}`;

        if (ownerEmails.length > 0) {
            await sendRealEmail({
                to: ownerEmails,
                subject: `Approval Required: Quotation ${formattedNumber} (${invoice.client.name} — R${invoice.total.toLocaleString()})`,
                body: `Hello,\n\nQuotation ${formattedNumber} for ${invoice.client.name} exceeds the R50,000 approval limit.\n\nTotal: R${invoice.total.toFixed(2)}\nRequested by: ${authUser?.name || authUser?.email}\nSite: ${invoice.site || 'N/A'}\n\nYou can review and approve it with 1-click at:\n${quoteUrl}\n\nUROps Automated Notification`,
                from: 'UROps Notifications <info@aerowash.co.za>'
            });
        }

        return { success: true };
    } catch (e: any) {
        console.error("requestQuoteApprovalAction error:", e);
        return { success: false, error: e.message || "Failed to request approval" };
    }
}

export async function ownerApproveQuoteAction(invoiceId: string) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();

        // Dynamic Owner Verification: checks isOwner flag on company membership
        if (!authUser?.isOwner) {
            return { success: false, error: "Only a company OWNER can approve quotes over R50,000." };
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId }
        });
        if (!invoice) return { success: false, error: "Invoice not found" };

        const currentMeta = (invoice.metadata as any) || {};
        const updatedMeta = {
            ...currentMeta,
            approvalStatus: 'APPROVED',
            needsApproval: false,
            approvedAt: new Date().toISOString(),
            approvedBy: authUser?.name || authUser?.email || 'Owner'
        };

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { metadata: updatedMeta }
        });

        return { success: true };
    } catch (e: any) {
        console.error("ownerApproveQuoteAction error:", e);
        return { success: false, error: e.message || "Failed to approve quote" };
    }
}

export const approveQuoteAction = ownerApproveQuoteAction;

export async function getQuoteShareLinkAction(invoiceId: string) {
    const perm = await verifyQuoteActionPermission(invoiceId, 'SHARE_LINK');
    if (!perm.allowed) {
        return { success: false, error: perm.error };
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app';
    return { success: true, shareUrl: `${appUrl}/invoices/${invoiceId}?view=client` };
}

export async function getPendingApprovalsAction() {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        if (!authUser?.isOwner) return { quotes: [] };

        const quotes = await prisma.invoice.findMany({
            where: {
                companyId,
                type: 'QUOTE',
                total: { gt: 50000 }
            },
            select: {
                id: true,
                quoteNumber: true,
                total: true,
                metadata: true,
                date: true,
                client: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });

        const pending = quotes.filter(q => (q.metadata as any)?.approvalStatus !== 'APPROVED');
        return {
            quotes: pending.map(q => ({
                id: q.id,
                quoteNumber: q.quoteNumber,
                clientName: q.client?.name || 'Unknown Client',
                total: q.total
            }))
        };
    } catch (e: any) {
        console.error("getPendingApprovalsAction error:", e);
        return { quotes: [] };
    }
}
