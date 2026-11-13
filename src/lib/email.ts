import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

export const SAFE_TEST_EMAIL_RECIPIENT = 'utiravat@gmail.com';

const AEROWASH_COMPANY_ID = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
const LR_BUILDERS_COMPANY_ID = '299c43ec-9578-4c45-91cb-a881a539e25d';

export type SendEmailAttachment = {
    filename: string;
    /** Raw bytes or a base64 string */
    content: Buffer | string;
    contentType?: string;
    /** Embeds the file inline; reference it in HTML as cid:<contentId> */
    contentId?: string;
};

export type EmailSendLogRecord = {
    timestamp: string;
    mode: 'TEST' | 'REAL';
    to: string[];
    intendedTo: string[];
    subject: string;
    company: string;
    companyId: string | null;
    reason: string;
    resendId?: string | null;
    status: 'SENT' | 'FAILED';
    error?: string;
};

function getResendClientForCompany(isAero: boolean): { client: Resend | null; error?: string } {
    const runtimeEnv = process.env as Record<string, string | undefined>;
    if (isAero) {
        const key = (runtimeEnv['RESEND_API_KEY_AEROWASH'] || '').trim();
        if (!key) {
            return {
                client: null,
                error: 'AeroWash email provider not configured. Please add RESEND_API_KEY_AEROWASH to your environment variables.',
            };
        }
        return { client: new Resend(key) };
    }

    const key = (runtimeEnv['RESEND_API_KEY'] || '').trim();
    if (!key) {
        return {
            client: null,
            error: 'Email provider not configured. Please add RESEND_API_KEY to your environment variables.',
        };
    }
    return { client: new Resend(key) };
}

function mapAttachments(list?: SendEmailAttachment[]) {
    if (!list || list.length === 0) return undefined;
    return list.map(a => ({
        filename: a.filename,
        content: a.content,
        ...(a.contentType ? { contentType: a.contentType } : {}),
        ...(a.contentId ? { contentId: a.contentId } : {}),
    }));
}

function inferCompanyContext(data: {
    companyId?: string;
    companyName?: string;
    from?: string;
    replyTo?: string;
    subject?: string;
}): { companyId: string | null; companyName: string } {
    const displayName = data.from?.includes('<') ? data.from.split('<')[0].trim() : '';
    const combined = `${data.companyName || ''} ${displayName} ${data.from || ''} ${data.replyTo || ''} ${data.subject || ''}`.toLowerCase();

    if (data.companyId) {
        const name =
            data.companyName?.trim() ||
            displayName ||
            (data.companyId === AEROWASH_COMPANY_ID
                ? 'AeroWash (Pty) Ltd'
                : data.companyId === LR_BUILDERS_COMPANY_ID
                ? 'LR Builders'
                : 'Workspace');
        return { companyId: data.companyId, companyName: name };
    }

    if (combined.includes('aerowash')) {
        return {
            companyId: AEROWASH_COMPANY_ID,
            companyName: data.companyName?.trim() || displayName || 'AeroWash (Pty) Ltd',
        };
    }
    if (combined.includes('lr builders') || combined.includes('lrbuilders')) {
        return {
            companyId: LR_BUILDERS_COMPANY_ID,
            companyName: data.companyName?.trim() || displayName || 'LR Builders',
        };
    }

    return {
        companyId: null,
        companyName: data.companyName?.trim() || displayName || 'Unknown',
    };
}

/**
 * Evaluates whether an outgoing email is allowed to go to real recipients or must be
 * hard-redirected to utiravat@gmail.com with "[TEST]" in the subject.
 *
 * Rules:
 * - Redirect ALL email to utiravat@gmail.com with "[TEST]" whenever:
 *   1. VERCEL_ENV !== 'production', OR
 *   2. EMAIL_TEST_MODE === 'true', OR
 *   3. data.isTest === true, OR
 *   4. The send comes from any script/test/fixture (no Next.js request headers or CLI argv), OR
 *   5. data.triggeredByUserAction !== true (default to TEST mode whenever unsure).
 * - Real recipients are used ONLY when it is live production AND triggered by a real user action in the app.
 */
export async function evaluateEmailSafetyMode(data: {
    isTest?: boolean;
    triggeredByUserAction?: boolean;
}): Promise<{ mode: 'TEST' | 'REAL'; reason: string }> {
    const runtimeEnv = process.env as Record<string, string | undefined>;
    const vercelEnv = (runtimeEnv['VERCEL_ENV'] || '').trim();
    const emailTestMode = (runtimeEnv['EMAIL_TEST_MODE'] || '').trim().toLowerCase() === 'true';

    if (data.isTest === true) {
        return { mode: 'TEST', reason: 'explicit_isTest_flag' };
    }
    if (emailTestMode) {
        return { mode: 'TEST', reason: 'EMAIL_TEST_MODE_enabled' };
    }
    if (vercelEnv !== 'production') {
        return { mode: 'TEST', reason: `VERCEL_ENV_is_${vercelEnv || 'unset_non_production'}` };
    }

    const argvStr =
        typeof process !== 'undefined' && Array.isArray(process.argv)
            ? process.argv.join(' ')
            : '';
    if (/scripts[\\/]|test|fixture|tsx|ts-node|jest|vitest|playwright/i.test(argvStr)) {
        return { mode: 'TEST', reason: 'cli_script_or_test_process' };
    }

    if (data.triggeredByUserAction !== true) {
        return { mode: 'TEST', reason: 'not_marked_triggeredByUserAction' };
    }

    let hasActiveRequestHeaders = false;
    try {
        const { headers } = await import('next/headers');
        const reqHeaders = headers();
        hasActiveRequestHeaders = Boolean(
            reqHeaders &&
            (reqHeaders.get('host') || reqHeaders.get('user-agent') || reqHeaders.get('next-action'))
        );
    } catch {
        hasActiveRequestHeaders = false;
    }

    if (!hasActiveRequestHeaders) {
        return { mode: 'TEST', reason: 'no_nextjs_request_context' };
    }

    return { mode: 'REAL', reason: 'live_production_user_action' };
}

async function logEmailSendInApp(
    record: EmailSendLogRecord,
    opts?: { actorUserId?: string | null; actorName?: string | null; skipDbAuditLog?: boolean }
) {
    // 1. Always emit structured server log
    console.info('[Email Send Log]', JSON.stringify(record));

    // 2. Persist in CompanyAuditLog in the app database when companyId is known and not explicitly skipped
    if (record.companyId && !opts?.skipDbAuditLog) {
        try {
            await prisma.companyAuditLog.create({
                data: {
                    companyId: record.companyId,
                    actorUserId: opts?.actorUserId || null,
                    actorName: opts?.actorName || record.company,
                    action: record.mode === 'TEST' ? 'EMAIL_SENT_TEST' : 'EMAIL_SENT_REAL',
                    targetEmail: record.to.join(', '),
                    details: {
                        mode: record.mode,
                        to: record.to,
                        intendedTo: record.intendedTo,
                        subject: record.subject,
                        company: record.company,
                        reason: record.reason,
                        resendId: record.resendId || null,
                        status: record.status,
                        ...(record.error ? { error: record.error } : {}),
                    },
                },
            });
        } catch (logErr) {
            console.warn('[Email Service] Could not write CompanyAuditLog row:', logErr);
        }
    }
}

export async function sendRealEmail(data: {
    to: string | string[];
    from?: string;
    replyTo?: string;
    subject: string;
    body: string;
    html?: string;
    attachments?: SendEmailAttachment[];
    companyId?: string;
    companyName?: string;
    actorUserId?: string | null;
    actorName?: string | null;
    triggeredByUserAction?: boolean;
    isTest?: boolean;
    skipDbAuditLog?: boolean;
}) {
    const intendedRecipients = (Array.isArray(data.to) ? data.to : [data.to])
        .map(r => String(r || '').trim())
        .filter(Boolean);

    const { mode, reason } = await evaluateEmailSafetyMode({
        isTest: data.isTest,
        triggeredByUserAction: data.triggeredByUserAction,
    });

    const { companyId, companyName } = inferCompanyContext(data);
    const isAero =
        companyId === AEROWASH_COMPANY_ID ||
        companyName.toLowerCase().includes('aerowash') ||
        Boolean(data.from && data.from.toLowerCase().includes('aerowash')) ||
        Boolean(data.replyTo && data.replyTo.toLowerCase().includes('aerowash.co.za'));

    const { client: resend, error: clientErr } = getResendClientForCompany(isAero);

    // Hard safety switch: in TEST mode, ALL outgoing email goes ONLY to utiravat@gmail.com with "[TEST]" in subject.
    const actualRecipients =
        mode === 'REAL' ? intendedRecipients : [SAFE_TEST_EMAIL_RECIPIENT];

    const rawSubject = (data.subject || '').trim();
    const finalSubject =
        mode === 'TEST'
            ? /^\[TEST\]/i.test(rawSubject)
                ? rawSubject
                : `[TEST] ${rawSubject}`
            : rawSubject;

    const testNoteText =
        mode === 'TEST'
            ? `\n\n---\n[TEST MODE SAFETY SWITCH: Redirected to ${SAFE_TEST_EMAIL_RECIPIENT} (${reason}) | Original intended recipient(s): ${intendedRecipients.join(', ')}]`
            : '';

    const testBannerHtml =
        mode === 'TEST'
            ? `<div style="background:#fef3c7;color:#92400e;padding:10px 14px;margin-bottom:14px;border:1px solid #f59e0b;border-radius:6px;font-family:sans-serif;font-size:12px;">` +
              `<strong>[TEST MODE SAFETY SWITCH]</strong> Redirected to <code>${SAFE_TEST_EMAIL_RECIPIENT}</code> (${reason}). ` +
              `<strong>Original intended recipient(s):</strong> ${intendedRecipients.join(', ')}` +
              `</div>`
            : '';

    const finalText = data.body + testNoteText;
    const baseHtml =
        data.html ||
        `<div style="font-family: sans-serif; white-space: pre-wrap;">${data.body}</div>`;
    const finalHtml = testBannerHtml ? testBannerHtml + baseHtml : baseHtml;

    if (!resend) {
        const err = clientErr || "Email provider not configured. Please add RESEND_API_KEY to your environment variables.";
        console.error("[Email Service]", err);
        await logEmailSendInApp(
            {
                timestamp: new Date().toISOString(),
                mode,
                to: actualRecipients,
                intendedTo: intendedRecipients,
                subject: finalSubject,
                company: companyName,
                companyId,
                reason,
                status: 'FAILED',
                error: err,
            },
            { actorUserId: data.actorUserId, actorName: data.actorName, skipDbAuditLog: data.skipDbAuditLog }
        );
        return { success: false, error: err, mode, deliveredTo: actualRecipients, subject: finalSubject };
    }

    try {
        const attachments = mapAttachments(data.attachments);
        // Clean reply-to address
        const rawCompanyEmail =
            data.replyTo ||
            (data.from?.includes('<') ? data.from.replace(/.*<([^>]+)>.*/, '$1') : data.from) ||
            undefined;
        const replyTo = rawCompanyEmail && rawCompanyEmail.includes('@') ? rawCompanyEmail : undefined;

        // Display name always comes from the sending company ("Name <addr>"); never a hard-coded product/company name.
        const displayName = data.from?.includes('<') ? data.from.split('<')[0].trim() : '';
        const defaultFromName = displayName || companyName || 'Notifications';

        // Determine initial from address
        const fromAddress = data.from || `${defaultFromName} <onboarding@resend.dev>`;

        let response = await resend.emails.send({
            from: fromAddress,
            replyTo,
            to: actualRecipients,
            subject: finalSubject,
            text: finalText,
            html: finalHtml,
            attachments,
        });

        // For non-AeroWash only: If domain is not verified on Resend, automatically fall back to Resend default sender with reply-to
        // For AeroWash: AeroWash email must fail with a clear error, NOT fall back to another sender
        if (!isAero && response.error && (response.error.message?.includes('not verified') || response.error.name === 'validation_error')) {
            console.warn(`[Email Service] Domain in "${fromAddress}" not verified on Resend. Falling back to default sender <onboarding@resend.dev> with reply-to: ${replyTo}`);

            const fallbackFrom = `${defaultFromName} <onboarding@resend.dev>`;

            response = await resend.emails.send({
                from: fallbackFrom,
                replyTo,
                to: actualRecipients,
                subject: finalSubject,
                text: finalText,
                html: finalHtml,
                attachments,
            });
        }

        // For non-AeroWash only: Handle Resend sandbox restriction: if domain is unverified and recipient is not account owner,
        // reroute to verified account owner (utiravat@gmail.com) so notifications never get lost
        if (!isAero && response.error && response.error.message?.includes('testing emails to your own email address')) {
            console.warn(`[Email Service] Sandbox mode: rerouting to registered account owner (${SAFE_TEST_EMAIL_RECIPIENT}) for recipients [${actualRecipients.join(', ')}]`);
            const sandboxSubject = /^\[TEST\]/i.test(finalSubject)
                ? finalSubject
                : `[Sandbox Delivery for ${actualRecipients.join(', ')}] ${finalSubject}`;
            const sandboxNote = `\n\n---\n[Resend Notice: Delivered to ${SAFE_TEST_EMAIL_RECIPIENT} because the sending domain's DNS records are pending verification. Intended recipient: ${ intendedRecipients.join(', ') }]`;

            const sandboxResponse = await resend.emails.send({
                from: `${defaultFromName} <onboarding@resend.dev>`,
                replyTo,
                to: [SAFE_TEST_EMAIL_RECIPIENT],
                subject: sandboxSubject,
                text: finalText + sandboxNote,
                html:
                    `<div style="background: #fff3cd; color: #856404; padding: 12px; margin-bottom: 16px; border-radius: 6px; font-family: sans-serif; font-size: 13px;">
                        <strong>Resend Sandbox Delivery:</strong> Delivered to <code>${SAFE_TEST_EMAIL_RECIPIENT}</code> because the sending domain's DNS records are pending verification.<br/>
                        <strong>Intended Recipient(s):</strong> ${intendedRecipients.join(', ')}
                    </div>` + finalHtml,
                attachments,
            });

            if (!sandboxResponse.error) {
                const logEntry: EmailSendLogRecord = {
                    timestamp: new Date().toISOString(),
                    mode,
                    to: [SAFE_TEST_EMAIL_RECIPIENT],
                    intendedTo: intendedRecipients,
                    subject: sandboxSubject,
                    company: companyName,
                    companyId,
                    reason: `${reason}+resend_sandbox_fallback`,
                    resendId: sandboxResponse.data?.id || null,
                    status: 'SENT',
                };
                await logEmailSendInApp(logEntry, {
                    actorUserId: data.actorUserId,
                    actorName: data.actorName,
                    skipDbAuditLog: data.skipDbAuditLog,
                });
                return {
                    success: true,
                    id: sandboxResponse.data?.id,
                    mode,
                    sandboxRerouted: true,
                    deliveredTo: SAFE_TEST_EMAIL_RECIPIENT,
                    intendedTo: intendedRecipients,
                    subject: sandboxSubject,
                    company: companyName,
                    note: `Delivered to registered Resend account (${SAFE_TEST_EMAIL_RECIPIENT}) while the sending domain's DNS verification is pending.`,
                };
            }
        }

        if (response.error) {
            console.error("[Email Service] Resend Error:", response.error);
            await logEmailSendInApp(
                {
                    timestamp: new Date().toISOString(),
                    mode,
                    to: actualRecipients,
                    intendedTo: intendedRecipients,
                    subject: finalSubject,
                    company: companyName,
                    companyId,
                    reason,
                    status: 'FAILED',
                    error: response.error.message,
                },
                { actorUserId: data.actorUserId, actorName: data.actorName, skipDbAuditLog: data.skipDbAuditLog }
            );
            return { success: false, error: response.error.message, mode, deliveredTo: actualRecipients, subject: finalSubject };
        }

        const logEntry: EmailSendLogRecord = {
            timestamp: new Date().toISOString(),
            mode,
            to: actualRecipients,
            intendedTo: intendedRecipients,
            subject: finalSubject,
            company: companyName,
            companyId,
            reason,
            resendId: response.data?.id || null,
            status: 'SENT',
        };
        await logEmailSendInApp(logEntry, {
            actorUserId: data.actorUserId,
            actorName: data.actorName,
            skipDbAuditLog: data.skipDbAuditLog,
        });

        return {
            success: true,
            id: response.data?.id,
            mode,
            testRerouted: mode === 'TEST',
            deliveredTo: actualRecipients.join(', '),
            intendedTo: intendedRecipients,
            subject: finalSubject,
            company: companyName,
        };
    } catch (error) {
        console.error("[Email Service] Failed to send real email:", error);
        await logEmailSendInApp(
            {
                timestamp: new Date().toISOString(),
                mode,
                to: actualRecipients,
                intendedTo: intendedRecipients,
                subject: finalSubject,
                company: companyName,
                companyId,
                reason,
                status: 'FAILED',
                error: String(error),
            },
            { actorUserId: data.actorUserId, actorName: data.actorName, skipDbAuditLog: data.skipDbAuditLog }
        );
        return { success: false, error: String(error), mode, deliveredTo: actualRecipients, subject: finalSubject };
    }
}
