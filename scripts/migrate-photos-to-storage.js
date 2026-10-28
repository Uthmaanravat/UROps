const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read environment
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const prisma = new PrismaClient();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const BUCKET = 'quotation-photos';

async function migrate() {
  console.log('--- Starting Photos Migration to Private Supabase Storage ---');
  const invoices = await prisma.invoice.findMany({
    select: { id: true, number: true, companyId: true, metadata: true }
  });

  let migratedCount = 0;
  for (const inv of invoices) {
    const meta = inv.metadata;
    if (meta && meta.siteVisitPhotos && Array.isArray(meta.siteVisitPhotos) && meta.siteVisitPhotos.length > 0) {
      let changed = false;
      const updatedPhotos = [];

      for (let idx = 0; idx < meta.siteVisitPhotos.length; idx++) {
        const photo = meta.siteVisitPhotos[idx];
        if (photo.url && photo.url.startsWith('data:')) {
          const num = photo.photoNumber || (idx + 1).toString().padStart(2, '0');
          const storagePath = `${inv.companyId}/${inv.id}/photo-${num}.jpg`;

          // Parse base64
          const matches = photo.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          const buffer = matches && matches.length === 3
            ? Buffer.from(matches[2], 'base64')
            : Buffer.from(photo.url.replace(/^data:image\/\w+;base64,/, ''), 'base64');

          console.log(`Uploading invoice ${inv.number} photo ${num} (${buffer.length} bytes) to ${storagePath}...`);
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (upErr) {
            console.error(`Upload error for photo ${num}:`, upErr);
            updatedPhotos.push(photo);
          } else {
            changed = true;
            updatedPhotos.push({
              ...photo,
              url: storagePath
            });
          }
        } else {
          updatedPhotos.push(photo);
        }
      }

      if (changed) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            metadata: {
              ...meta,
              siteVisitPhotos: updatedPhotos
            }
          }
        });
        migratedCount++;
        console.log(`Updated invoice ${inv.number} metadata with migrated paths.`);
      }
    }
  }

  console.log(`--- Migration complete. Migrated ${migratedCount} invoices. ---`);
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
