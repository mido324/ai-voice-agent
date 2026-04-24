import { readFileSync } from 'node:fs';

const raw = readFileSync('.env');
const text = raw.toString('utf8');
const lines = text.split(/\r?\n/);

const openaiLines = lines.filter((l) => /OPENAI/i.test(l));
console.log('OPENAI lines:', openaiLines.length);

openaiLines.forEach((l, i) => {
  console.log(`\n[${i}] length=${l.length}`);
  console.log(`  first 20 bytes (hex): ${Array.from(Buffer.from(l).slice(0, 20)).map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
  console.log(`  first 20 chars: "${l.slice(0, 20)}"`);
  console.log(`  last 20 chars:  "${l.slice(-20)}"`);
});
