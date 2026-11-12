const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    if (process.env.ALLOW_PRODUCTION_WRITE !== 'true') {
        throw new Error('[DB GUARDRAIL] Execution aborted: ALLOW_PRODUCTION_WRITE is not set to "true".');
    }

    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error('DATABASE_URL is missing.');

    const publicUrl = rawUrl.includes('schema=')
        ? rawUrl.replace(/schema=[^&]+/, 'schema=public')
        : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}schema=public`;

    console.log('[DB GUARDRAIL] Target schema: "public" (ALLOW_PRODUCTION_WRITE: true)');

    const prisma = new PrismaClient({ datasources: { db: { url: publicUrl } } });

    const quoteIds = [
        '2c52ca5b-101f-4199-b05e-bcb5ad0794fa', // AW-COMM-001
        '55ea68e6-6896-434a-880c-872b1b36e527', // AW-2026-014
        '51083790-879b-49ab-96cf-819ccdeb06c8'  // AW-2026-008
    ];

    const clientIds = [
        '9079c706-9276-4b4a-823e-4b7fa128620c', // Apex Commercial Properties
        '71d1354e-4423-4dcd-8b35-1f7f4572aa96'  // Test Company
    ];

    const projectIds = [
        '1c107bb4-255e-4d4d-b6c9-09ce45c7d16c' // New Project (Test Project)
    ];

    const jobSheetIds = [
        'd930507f-2e49-4739-afb2-4526a8e8a760' // Job Sheet #1
    ];

    const invitationIds = [
        'bb5c5375-1261-4833-ada4-bd797831d67b' // Crew invitation
    ];

    const aerowashCompanyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

    try {
        // --- STEP 1: BACKUP ALL TARGET RECORDS ---
        console.log('\n--- STEP 1: Creating backup of records to be deleted ---');
        const backupData = {
            timestamp: new Date().toISOString(),
            quotes: await prisma.invoice.findMany({ where: { id: { in: quoteIds } }, include: { items: true } }),
            clients: await prisma.client.findMany({ where: { id: { in: clientIds } } }),
            projects: await prisma.project.findMany({ where: { id: { in: projectIds } } }),
            jobSheets: await prisma.jobSheet.findMany({ where: { id: { in: jobSheetIds } } }),
            invitations: await prisma.invitation.findMany({ where: { id: { in: invitationIds } } }),
            aerowashSettingsBefore: await prisma.companySettings.findFirst({ where: { companyId: aerowashCompanyId } })
        };

        const backupDir = path.resolve('backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const localBackupPath = path.join(backupDir, 'production_test_cleanup_backup_2026-11-12.json');
        fs.writeFileSync(localBackupPath, JSON.stringify(backupData, null, 2));
        console.log('Saved local backup to:', localBackupPath);

        const artifactDir = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';
        if (fs.existsSync(artifactDir)) {
            const artifactBackupPath = path.join(artifactDir, 'production_test_cleanup_backup_2026-11-12.json');
            fs.writeFileSync(artifactBackupPath, JSON.stringify(backupData, null, 2));
            console.log('Saved artifact backup to:', artifactBackupPath);
        }

        // --- STEP 2: REMOVE STORAGE PHOTO IF EXISTS ---
        console.log('\n--- STEP 2: Attempting deletion of Job Sheet #1 storage photo ---');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
            const sb = createClient(supabaseUrl, supabaseKey);
            const photoPath = '70af7281-072d-4ed5-9f2e-af4d93e99ea9/jobs/1c107bb4-255e-4d4d-b6c9-09ce45c7d16c/elevation_before_Elevation_1_opt1a_verify_photo.jpg';
            const { data: removeRes, error: removeErr } = await sb.storage.from('quotation-photos').remove([photoPath]);
            console.log('Supabase storage remove result:', { removeRes, removeErr: removeErr?.message || null });
        }

        // --- STEP 3: EXECUTE TRANSACTION DELETION ---
        console.log('\n--- STEP 3: Executing database deletions in transaction ---');
        const results = await prisma.$transaction(async (tx) => {
            // 1. Delete Invoice Items for target quotes
            const deletedItems = await tx.invoiceItem.deleteMany({
                where: { invoiceId: { in: quoteIds } }
            });

            // 2. Delete Job Sheets
            const deletedJobSheets = await tx.jobSheet.deleteMany({
                where: { id: { in: jobSheetIds } }
            });

            // 3. Delete Invoices / Quotes
            const deletedInvoices = await tx.invoice.deleteMany({
                where: { id: { in: quoteIds } }
            });

            // 4. Delete Projects
            const deletedProjects = await tx.project.deleteMany({
                where: { id: { in: projectIds } }
            });

            // 5. Delete Clients
            const deletedClients = await tx.client.deleteMany({
                where: { id: { in: clientIds } }
            });

            // 6. Delete Invitation
            const deletedInvitations = await tx.invitation.deleteMany({
                where: { id: { in: invitationIds } }
            });

            // 7. Update AeroWash CompanySettings counters
            const updatedSettings = await tx.companySettings.update({
                where: { companyId: aerowashCompanyId },
                data: {
                    lastQuoteNumber: 14,
                    lastInvoiceNumber: 0
                }
            });

            return {
                deletedItemsCount: deletedItems.count,
                deletedJobSheetsCount: deletedJobSheets.count,
                deletedInvoicesCount: deletedInvoices.count,
                deletedProjectsCount: deletedProjects.count,
                deletedClientsCount: deletedClients.count,
                deletedInvitationsCount: deletedInvitations.count,
                updatedSettings: {
                    lastQuoteNumber: updatedSettings.lastQuoteNumber,
                    lastInvoiceNumber: updatedSettings.lastInvoiceNumber
                }
            };
        });

        console.log('\n=== DELETION SUMMARY (counts deleted per table) ===');
        console.log('InvoiceItem:', results.deletedItemsCount);
        console.log('JobSheet:', results.deletedJobSheetsCount);
        console.log('Invoice (Quotes):', results.deletedInvoicesCount);
        console.log('Project:', results.deletedProjectsCount);
        console.log('Client:', results.deletedClientsCount);
        console.log('Invitation:', results.deletedInvitationsCount);
        console.log('AeroWash Counters Updated:', results.updatedSettings);

        // --- STEP 4: VERIFICATION ---
        console.log('\n--- STEP 4: Verifying database state post-deletion ---');
        const remainingQuotes = await prisma.invoice.count({ where: { id: { in: quoteIds } } });
        const remainingClients = await prisma.client.count({ where: { id: { in: clientIds } } });
        const remainingProjects = await prisma.project.count({ where: { id: { in: projectIds } } });
        const remainingJobSheets = await prisma.jobSheet.count({ where: { id: { in: jobSheetIds } } });
        const remainingInvitations = await prisma.invitation.count({ where: { id: { in: invitationIds } } });

        console.log('Remaining target quotes (should be 0):', remainingQuotes);
        console.log('Remaining target clients (should be 0):', remainingClients);
        console.log('Remaining target projects (should be 0):', remainingProjects);
        console.log('Remaining target job sheets (should be 0):', remainingJobSheets);
        console.log('Remaining target invitations (should be 0):', remainingInvitations);

        // Verify Marcella Residencial is still intact
        const marcella = await prisma.client.findFirst({
            where: { name: { contains: 'Marcella', mode: 'insensitive' } }
        });
        console.log('Client Marcella Residencial status:', marcella ? `INTACT (id: ${marcella.id}, name: ${marcella.name})` : 'MISSING ERROR!');

        // Verify AeroWash settings
        const currentSettings = await prisma.companySettings.findFirst({
            where: { companyId: aerowashCompanyId }
        });
        console.log('AeroWash Settings Counters:', {
            lastQuoteNumber: currentSettings.lastQuoteNumber,
            nextQuoteExpected: `AW-2026-0${currentSettings.lastQuoteNumber + 1}`,
            lastInvoiceNumber: currentSettings.lastInvoiceNumber,
            nextInvoiceExpected: `INV-2026-00${currentSettings.lastInvoiceNumber + 1}`
        });

    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('Execution failed:', err);
    process.exit(1);
});
