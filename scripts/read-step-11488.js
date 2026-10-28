const fs = require('fs');
const readline = require('readline');

async function main() {
    const fileStream = fs.createReadStream('C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105/.system_generated/logs/transcript_full.jsonl');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (line.includes('"step_index":11488')) {
            const obj = JSON.parse(line);
            console.log(obj.thinking ? obj.thinking.substring(0, 1000) : 'no thinking');
            console.log(obj.tool_calls);
            break;
        }
    }
}
main();
