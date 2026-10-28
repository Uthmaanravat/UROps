const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            env[key] = val;
        }
    }
}

async function testUpload() {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const testBuffer = Buffer.from('test photo content', 'utf8');

    console.log('Testing upload to quotation-photos...');
    const { data, error } = await supabase.storage
        .from('quotation-photos')
        .upload('test-company/test-quote/01.jpg', testBuffer, {
            contentType: 'image/jpeg',
            upsert: true
        });

    console.log('Upload result:', { data, error });

    if (data) {
        console.log('Testing signed URL creation...');
        const { data: signedData, error: signedError } = await supabase.storage
            .from('quotation-photos')
            .createSignedUrl('test-company/test-quote/01.jpg', 3600);
        console.log('Signed URL result:', { signedData, signedError });
    }
}
testUpload();
