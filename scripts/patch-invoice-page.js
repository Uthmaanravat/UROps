const fs = require('fs');
let c = fs.readFileSync('src/app/(dashboard)/invoices/[id]/page.tsx', 'utf8');
const target = `    if (!invoice) {
        notFound();
    }`;

const addition = `    if (!invoice) {
        notFound();
    }

    if ((invoice as any).metadata?.siteVisitPhotos && Array.isArray((invoice as any).metadata.siteVisitPhotos)) {
        const { resolvePhotoUrls } = await import("@/lib/supabase-storage");
        (invoice as any).metadata.siteVisitPhotos = await resolvePhotoUrls((invoice as any).metadata.siteVisitPhotos);
    }`;

// Handle CRLF vs LF
const normalizedC = c.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');
const normalizedAddition = addition.replace(/\r\n/g, '\n');

if (normalizedC.includes(normalizedTarget)) {
  const updated = normalizedC.replace(normalizedTarget, normalizedAddition);
  fs.writeFileSync('src/app/(dashboard)/invoices/[id]/page.tsx', updated.replace(/\n/g, '\r\n'));
  console.log('Successfully patched page.tsx');
} else {
  console.log('Target not found in page.tsx');
}
