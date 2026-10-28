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
            env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        }
    }
}

async function checkBuckets() {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: buckets, error } = await supabase.storage.listBuckets();
    console.log('Buckets list result:');
    if (error) {
        console.error('Error listing buckets:', error);
    } else {
        console.log('Buckets found:', buckets);
    }
}

checkBuckets().catch(console.error);
