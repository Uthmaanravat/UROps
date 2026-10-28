const fs = require('fs');
const lines = fs.readFileSync('C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
for (const l of lines) {
    if (l.includes('"step_index":11609') || l.includes('"step_index":11610')) {
        console.log(l.slice(0, 500));
    }
}
