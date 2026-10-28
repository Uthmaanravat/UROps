const { getSupabaseAdmin, uploadQuotePhoto, getSignedPhotoUrl, BUCKET_NAME } = require('../src/lib/supabase-storage');

async function testStorageFlow() {
  console.log('Testing Supabase Storage photo workflow...');
  const companyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
  const quoteId = 'test-quote-123';
  const dummyBuffer = Buffer.from('fake-jpeg-photo-bytes-for-test');

  const path = await uploadQuotePhoto(companyId, quoteId, '01.jpg', dummyBuffer);
  console.log('Uploaded photo path:', path);

  const signedUrl = await getSignedPhotoUrl(path, 3600);
  console.log('Signed URL generated:', signedUrl.substring(0, 80) + '...');

  // Download back
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(BUCKET_NAME).download(path);
  console.log('Downloaded data size:', data ? data.size : error);
}

testStorageFlow().catch(console.error);
