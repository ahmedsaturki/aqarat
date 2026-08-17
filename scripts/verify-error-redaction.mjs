import fs from 'node:fs/promises';
import path from 'node:path';

const roots = ['api', 'src'];
const ignored = /(?:\.test\.mjs$|node_modules|\.git)/;
const forbidden = [
  /console\.error\([^\n]*error\.message/,
  /console\.error\([^\n]*String\(error\)/,
  /console\.error\([^\n]*error\?\.message/,
];

async function filesUnder(root) {
  const output = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && full.endsWith('.mjs') && !ignored.test(full)) output.push(full);
    }
  }
  await visit(root);
  return output;
}

const violations = [];
for (const root of roots) {
  for (const file of await filesUnder(root)) {
    const lines = (await fs.readFile(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      if (forbidden.some((pattern) => pattern.test(line))) violations.push(`${file}:${index + 1}`);
    });
  }
}

if (violations.length) {
  console.error(`FAIL raw error logging: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('PASS no raw error.message logging in production modules');
}
