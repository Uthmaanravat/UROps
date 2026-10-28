const fs = require('fs');
const readline = require('readline');

async function main() {
    const fileStream = fs.createReadStream('C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105/.system_generated/logs/transcript_full.jsonl');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (line.includes('media_1793169623542_f21c3a20') || line.includes('media_1793171542685_7922b043')) {
            const obj = JSON.parse(line);
            console.log('STEP INDEX:', obj.step_index, 'TYPE:', obj.type);
            if (obj.thinking) {
                console.log('THINKING EXCERPT:', obj.thinking.substring(0, 1000));
            }
        }
    }
}
main();
