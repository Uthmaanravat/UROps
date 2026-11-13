import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { composeBrandedEmail } from "@/lib/email-compose";
import { sendRealEmail, SAFE_TEST_EMAIL_RECIPIENT } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
    // Strict safeguard: NEVER run in live production
    if (process.env.VERCEL_ENV === "production") {
        return NextResponse.json({ error: "Preview test endpoint disabled in production." }, { status: 403 });
    }

    try {
        const AW_COMPANY_ID = "70af7281-072d-4ed5-9f2e-af4d93e99ea9";
        const LR_COMPANY_ID = "299c43ec-9578-4c45-91cb-a881a539e25d";

        const [awSettings, lrSettings] = await Promise.all([
            prisma.companySettings.findUnique({ where: { companyId: AW_COMPANY_ID } }),
            prisma.companySettings.findUnique({ where: { companyId: LR_COMPANY_ID } })
        ]);

        // 1. Compose & Send ONE AeroWash Test Quote Email
        const awEmail = await composeBrandedEmail({
            companyId: AW_COMPANY_ID,
            settings: awSettings,
            email: {
                subject: (b) => `Quotation AW-2026-015 from ${b.shortName}`,
                greeting: "Hi Marcella,",
                paragraphs: [
                    "Please find attached your Quotation AW-2026-015 for Marcella Residencial, Camps Bay.",
                    "Review the details below, or reply to this email if you have any questions."
                ],
                rows: [
                    { label: "Total", value: "R3,000.00", strong: true },
                    { label: "Payment Terms", value: "Payment by EFT on completion" },
                    { label: "Valid until", value: "28 December 2026" },
                    { label: "Site", value: "Marcella Residencial, Camps Bay" }
                ],
                cta: {
                    label: "View & accept quote",
                    url: "https://ur-ops.vercel.app/quote/test-preview-link"
                },
                ctaNote: "This secure link is valid until 28 December 2026."
            }
        });

        const awResult = await sendRealEmail({
            to: SAFE_TEST_EMAIL_RECIPIENT,
            from: awEmail.from,
            replyTo: awEmail.replyTo,
            subject: awEmail.subject,
            body: awEmail.text,
            html: awEmail.html,
            companyId: AW_COMPANY_ID,
            companyName: awEmail.brand.name,
            skipDbAuditLog: true
        });

        // 2. Compose & Send ONE LR Builders Test Invoice Email
        const lrEmail = await composeBrandedEmail({
            companyId: LR_COMPANY_ID,
            settings: lrSettings,
            email: {
                subject: (b) => `Tax Invoice INV-2026-001 from ${b.shortName}`,
                greeting: "Hi Mrs Jacobs,",
                paragraphs: [
                    "Your Tax Invoice INV-2026-001 for City Hall Refurbishment is ready.",
                    "Reply to this email if you have any questions."
                ],
                rows: [
                    { label: "Amount due", value: "R46,230.00", strong: true },
                    { label: "Due date", value: "15 December 2026" }
                ],
                cta: {
                    label: "View invoice",
                    url: "https://ur-ops.vercel.app/invoices/test-preview-link"
                }
            }
        });

        const lrResult = await sendRealEmail({
            to: SAFE_TEST_EMAIL_RECIPIENT,
            from: lrEmail.from,
            replyTo: lrEmail.replyTo,
            subject: lrEmail.subject,
            body: lrEmail.text,
            html: lrEmail.html,
            companyId: LR_COMPANY_ID,
            companyName: lrEmail.brand.name,
            skipDbAuditLog: true
        });

        return NextResponse.json({
            success: true,
            aerowash: {
                success: awResult.success,
                resendId: awResult.id || null,
                from: awEmail.from,
                replyTo: awEmail.replyTo,
                mode: awResult.mode,
                subject: awResult.subject,
                error: awResult.error || null,
                deliveredTo: awResult.deliveredTo
            },
            lrbuilders: {
                success: lrResult.success,
                resendId: lrResult.id || null,
                from: lrEmail.from,
                replyTo: lrEmail.replyTo,
                mode: lrResult.mode,
                subject: lrResult.subject,
                error: lrResult.error || null,
                deliveredTo: lrResult.deliveredTo
            }
        });
    } catch (err: any) {
        console.error("Preview test email error:", err);
        return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
    }
}
