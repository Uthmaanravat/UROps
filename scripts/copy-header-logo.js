const fs = require('fs');
const path = require('path');
const artDir = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';
const logoPath = path.join(artDir, '.user_uploaded', 'media_1793203454939_6992a917.png');

if (fs.existsSync(logoPath)) {
  const buf = fs.readFileSync(logoPath);
  console.log('User dark logo size:', buf.length, 'bytes');
  // Copy to public/ or assets if useful
  const destDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, 'aerowash_header_logo.png'), buf);
  console.log('Saved to public/aerowash_header_logo.png');
} else {
  console.log('File not found:', logoPath);
}
