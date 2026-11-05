import fs from 'fs';
const p = 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(p, 'utf8').split('\n');
lines.forEach((line, idx) => {
  if (line.includes('USER_INPUT') && (line.includes('pier') || line.includes('Planar') || line.includes('dock') || line.includes('orient'))) {
    console.log(idx, line.slice(0, 300));
  }
});
