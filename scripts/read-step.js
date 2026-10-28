const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105/.system_generated/logs/transcript_full.jsonl'),
  crlfDelay: Infinity
});
rl.on('line', (line) => {
  if (line.includes('"step_index": 10270') || line.includes('"step_index":10270')) {
    const obj = JSON.parse(line);
    console.log(JSON.stringify(obj.tool_calls || obj.content, null, 2));
    process.exit(0);
  }
});
