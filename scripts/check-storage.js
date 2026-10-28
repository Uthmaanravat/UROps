const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => ({ name: b.name, public: b.public })), 'Error:', error);

  // Try test upload
  const testBuffer = Buffer.from('test-image-content');
  const path = 'test-company/test-quote/test.jpg';
  const { data: upData, error: upErr } = await supabase.storage
    .from('quotation-photos')
    .upload(path, testBuffer, { upsert: true, contentType: 'image/jpeg' });
  console.log('Upload test:', upData, upErr);

  const { data: signData, error: signErr } = await supabase.storage
    .from('quotation-photos')
    .createSignedUrl(path, 3600);
  console.log('Signed URL test:', signData?.signedUrl ? 'SUCCESS (got signed URL)' : signErr);
}

check();
