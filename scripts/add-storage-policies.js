const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function addPolicies() {
    const url = new URL(directUrl);
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    try {
        console.log('Adding RLS policies for quotation-photos bucket...');
        await prisma.$executeRawUnsafe(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies 
                    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow all ops on quotation-photos'
                ) THEN
                    CREATE POLICY "Allow all ops on quotation-photos"
                    ON storage.objects
                    FOR ALL
                    TO authenticated, anon
                    USING (bucket_id = 'quotation-photos')
                    WITH CHECK (bucket_id = 'quotation-photos');
                END IF;
            END $$;
        `);
        console.log('Policy created successfully.');
    } catch (e) {
        console.error('Error creating policy:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
addPolicies();
