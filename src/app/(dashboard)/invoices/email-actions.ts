'use server'

import { sendRealEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"

/**
 * Server-side gatekeeper:
 * Over-threshold quotes by non-owners are blocked server-side from PDF download, Excel export, email and share link until approved.
 * Per-company threshold: AeroWash = R50,000, LR Builders = off (NULL).
 */
export async function verifyQuoteActionPermission(
    invoiceId: string, 
    actionType: 'DOWNLOAD_PDF' | 'EMAIL' | 'SHARE_LINK' | 'EXPORT_EXCEL'
) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            select: { id: true, total: true, subtotal: true, type: true, quoteNumber: true, companyId: true, metadata: true }
        });
        if (!invoice) return { allowed: false, error: "Invoice not found or unauthorized." };

        // 1. Look up per-company approval threshold
        const settings = await prisma.companySettings.findUnique({ where: { companyId: invoice.companyId } });
        const threshold = settings?.approvalThreshold;

        // If threshold is not set (e.g. LR Builders), approval is entirely OFF!
        if (!threshold || threshold <= 0) {
            return { allowed: true };
        }

        const isOwner = authUser?.isOwner === true;
        const totalAmount = invoice.total || invoice.subtotal || 0;

        // If not a quote or under threshold, everyone is allowed
        if (invoice.type !== 'QUOTE' || totalAmount <= threshold) {
            return { allowed: true };
        }

        // Over-threshold quote: owner is always allowed
        if (isOwner) {
            return { allowed: true };
        }

        // Non-owner: check approval status
        const currentMeta = (invoice.metadata as any) || {};
        const approvalStatus = currentMeta.approvalStatus;

        if (approvalStatus !== 'APPROVED') {
            const actionLabel = actionType === 'DOWNLOAD_PDF' ? 'downloaded as PDF'
                              : actionType === 'EMAIL' ? 'sent via email'
                              : actionType === 'EXPORT_EXCEL' ? 'exported to Excel'
                              : 'shared via link';
            const statusLabel = approvalStatus === 'CHANGES_REQUESTED' ? 'Changes requested by owner' : 'Needs owner approval';
            return {
                allowed: false,
                error: `This quotation exceeds R${threshold.toLocaleString()} and requires owner approval before it can be ${actionLabel}. Current status: ${statusLabel}.`
            };
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

        // Server-side blocking: over threshold by non-owners requires owner approval
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
        const fromEmail = settings?.email || 'info@aerowash.co.za';
        const fromName = settings?.name || 'AeroWash';

        const formattedFrom = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;

        const result = await sendRealEmail({
            to: toEmails,
            subject,
            body: body,
            from: formattedFrom,
            replyTo: fromEmail,
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

        return { 
            success: true, 
            messageId: (result as any).id || (result as any).data?.id,
            sandboxRerouted: (result as any).sandboxRerouted,
            note: (result as any).note
        }
    } catch (error: any) {
        console.error("sendInvoiceEmail error:", error)
        return { success: false, error: error.message || "Failed to send email" }
    }
}

export async function requestQuoteApprovalAction(invoiceId: string, isResubmission = false) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { client: true }
        });
        if (!invoice) return { success: false, error: "Invoice not found" };

        const currentMeta = (invoice.metadata as any) || {};
        const existingHistory = Array.isArray(currentMeta.approvalHistory) ? currentMeta.approvalHistory : [];

        const newHistoryEntry = {
            action: isResubmission ? 'RESUBMITTED' : 'SUBMITTED',
            user: authUser?.name || authUser?.email || 'Admin User',
            userEmail: authUser?.email || '',
            timestamp: new Date().toISOString()
        };

        const updatedMeta = {
            ...currentMeta,
            approvalStatus: 'PENDING',
            needsApproval: true,
            approvalRequestedAt: new Date().toISOString(),
            approvalRequestedBy: authUser?.name || authUser?.email || 'Admin User',
            approvalRequestedByEmail: authUser?.email || '',
            approvalHistory: [...existingHistory, newHistoryEntry]
        };

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { metadata: updatedMeta }
        });

        // Dynamic Owner Lookup: Query all owners in this company
        const owners = await prisma.user.findMany({
            where: { companyId, isOwner: true },
            select: { email: true, notificationEmail: true, name: true }
        });

        // Recipient addresses: use notificationEmail or real login email (never invent admin@ addresses)
        const ownerEmails = owners.map(o => (o.notificationEmail && o.notificationEmail.trim()) || o.email).filter(Boolean);

        // Fetch company settings to check copyNotificationsTo
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        if (settings?.copyNotificationsTo && settings.copyNotificationsTo.includes('@')) {
            if (!ownerEmails.includes(settings.copyNotificationsTo)) {
                ownerEmails.push(settings.copyNotificationsTo);
            }
        }

        const formattedNumber = invoice.quoteNumber || `AW-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app';
        const quoteUrl = `${appUrl}/invoices/${invoice.id}`;

        if (ownerEmails.length > 0) {
            const subject = isResubmission
                ? `Resubmitted for Approval: Quotation ${formattedNumber} (${invoice.client.name} — R${invoice.total.toLocaleString()})`
                : `Approval Required: Quotation ${formattedNumber} (${invoice.client.name} — R${invoice.total.toLocaleString()})`;

            const body = isResubmission
                ? `Hello,\n\nQuotation ${formattedNumber} for ${invoice.client.name} has been revised and resubmitted for owner approval.\n\nTotal: R${invoice.total.toFixed(2)}\nUpdated by: ${authUser?.name || authUser?.email}\nSite: ${invoice.site || 'N/A'}\n\nYou can review and approve it at:\n${quoteUrl}\n\nUROps Automated Notification`
                : `Hello,\n\nQuotation ${formattedNumber} for ${invoice.client.name} exceeds the approval limit.\n\nTotal: R${invoice.total.toFixed(2)}\nRequested by: ${authUser?.name || authUser?.email}\nSite: ${invoice.site || 'N/A'}\n\nYou can review and 1-click approve or send it back with a note at:\n${quoteUrl}\n\nUROps Automated Notification`;

            const emailRes = await sendRealEmail({
                to: ownerEmails,
                subject,
                body,
                from: 'AeroWash Notifications <info@aerowash.co.za>'
            });

            if (!emailRes.success) {
                return { success: true, warning: `Approval requested, but owner email notification failed: ${emailRes.error}` };
            }
        }

        return { success: true };
    } catch (e: any) {
        console.error("requestQuoteApprovalAction error:", e);
        return { success: false, error: e.message || "Failed to request approval" };
    }
}

export async function resubmitQuoteApprovalAction(invoiceId: string) {
    return requestQuoteApprovalAction(invoiceId, true);
}

export async function ownerApproveQuoteAction(invoiceId: string) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();

        // Dynamic Owner Verification
        if (!authUser?.isOwner) {
            return { success: false, error: "Only a company OWNER can approve quotes over the limit." };
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId }
        });
        if (!invoice) return { success: false, error: "Invoice not found" };

        const currentMeta = (invoice.metadata as any) || {};
        const existingHistory = Array.isArray(currentMeta.approvalHistory) ? currentMeta.approvalHistory : [];

        const newHistoryEntry = {
            action: 'APPROVED',
            user: authUser?.name || authUser?.email || 'Owner',
            userEmail: authUser?.email || '',
            timestamp: new Date().toISOString()
        };

        const updatedMeta = {
            ...currentMeta,
            approvalStatus: 'APPROVED',
            needsApproval: false,
            approvedAt: new Date().toISOString(),
            approvedBy: authUser?.name || authUser?.email || 'Owner',
            approvalHistory: [...existingHistory, newHistoryEntry]
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


export async function sendBackQuoteAction(invoiceId: string, note: string) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();

        if (!authUser?.isOwner) {
            return { success: false, error: "Only a company OWNER can send back quotes for revision." };
        }

        if (!note || note.trim().length === 0) {
            return { success: false, error: "A note explaining the requested changes is required." };
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { client: true }
        });
        if (!invoice) return { success: false, error: "Invoice not found" };

        const currentMeta = (invoice.metadata as any) || {};
        const existingHistory = Array.isArray(currentMeta.approvalHistory) ? currentMeta.approvalHistory : [];

        const newHistoryEntry = {
            action: 'CHANGES_REQUESTED',
            note: note.trim(),
            user: authUser?.name || authUser?.email || 'Owner',
            userEmail: authUser?.email || '',
            timestamp: new Date().toISOString()
        };

        const updatedMeta = {
            ...currentMeta,
            approvalStatus: 'CHANGES_REQUESTED',
            latestOwnerNote: note.trim(),
            changesRequestedAt: new Date().toISOString(),
            changesRequestedBy: authUser?.name || authUser?.email || 'Owner',
            approvalHistory: [...existingHistory, newHistoryEntry]
        };

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { metadata: updatedMeta }
        });

        // Notify creator (never invent fake admin@ emails; use real login or notificationEmail)
        const creatorEmail = currentMeta.approvalRequestedByEmail || currentMeta.createdByUserEmail;
        const recipients: string[] = [];
        if (creatorEmail && creatorEmail.includes('@')) {
            const creatorUser = await prisma.user.findFirst({
                where: { companyId, email: creatorEmail },
                select: { email: true, notificationEmail: true }
            });
            const target = (creatorUser?.notificationEmail && creatorUser.notificationEmail.trim()) || creatorEmail;
            recipients.push(target);
        } else {
            const teamMembers = await prisma.user.findMany({
                where: { companyId },
                select: { email: true, notificationEmail: true, isOwner: true }
            });
            const nonOwners = teamMembers.filter(m => !m.isOwner);
            if (nonOwners.length > 0) {
                nonOwners.forEach(m => {
                    const target = (m.notificationEmail && m.notificationEmail.trim()) || m.email;
                    if (target) recipients.push(target);
                });
            } else if (authUser?.email) {
                recipients.push(authUser.email);
            }
        }

        // Copy all notifications to company-level address if configured (e.g. info@aerowash.co.za)
        const compSettings = await prisma.companySettings.findUnique({ where: { companyId } });
        if (compSettings?.copyNotificationsTo && compSettings.copyNotificationsTo.includes('@')) {
            if (!recipients.includes(compSettings.copyNotificationsTo)) {
                recipients.push(compSettings.copyNotificationsTo);
            }
        }

        const formattedNumber = invoice.quoteNumber || `AW-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app';
        const quoteUrl = `${appUrl}/invoices/${invoice.id}`;

        if (recipients.length > 0) {
            const emailRes = await sendRealEmail({
                to: recipients,
                from: 'AeroWash Review <info@aerowash.co.za>',
                subject: `Changes Requested: Quotation ${formattedNumber} (${invoice.client.name})`,
                body: `Hello,\n\nThe company owner has reviewed quotation ${formattedNumber} for ${invoice.client.name} and requested the following revisions:\n\n"${note.trim()}"\n\nPlease open the quote, make the requested adjustments, and save to resubmit for approval:\n${quoteUrl}\n\nUROps Quotation Review`,
            });

            if (!emailRes.success) {
                return { success: true, emailWarning: `Quote sent back, but email notification failed: ${emailRes.error}` };
            }
        }

        return { success: true };
    } catch (e: any) {
        console.error("sendBackQuoteAction error:", e);
        return { success: false, error: e.message || "Failed to send back quote." };
    }
}

export async function getQuoteShareLinkAction(invoiceId: string) {
    const perm = await verifyQuoteActionPermission(invoiceId, 'SHARE_LINK');
    if (!perm.allowed) {
        return { success: false, error: perm.error };
    }
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, metadata: true }
    });
    if (!invoice) return { success: false, error: "Quote not found" };

    const currentMeta = (invoice.metadata as any) || {};
    let shareToken = currentMeta.shareToken;
    if (!shareToken) {
        const crypto = await import("crypto");
        shareToken = crypto.randomBytes(16).toString('hex');
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                metadata: {
                    ...currentMeta,
                    shareToken
                }
            }
        });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app';
    return { success: true, shareUrl: `${appUrl}/quote/${shareToken}` };
}

export async function getPendingApprovalsAction() {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        const threshold = settings?.approvalThreshold;

        // If threshold is off (null), no approvals!
        if (!threshold || threshold <= 0) return { quotes: [] };
        if (!authUser?.isOwner) return { quotes: [] };

        const quotes = await prisma.invoice.findMany({
            where: {
                companyId,
                type: 'QUOTE',
                total: { gt: threshold }
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

        const pending = quotes.filter(q => (q.metadata as any)?.approvalStatus === 'PENDING');
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
