import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const requiredDocs = ['docs/DATA_BACKUP_RESTORE_RUNBOOK.md'];
const requiredEnvNames = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DASHBOARD_ADMIN_SECRET', 'GEMINI_API_KEY'];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["'][^"'\n]{12,}["']/i,
  /(?:xoxb-|ghp_|sk-[A-Za-z0-9_-]{20,})/i,
];

async function exists(file) {
  try { await fs.access(path.join(root, file)); return true; } catch { return false; }
}

async function migrationChecks() {
  const dir = path.join(root, 'supabase', 'migrations');
  const entries = (await fs.readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  const timestamps = entries.map((name) => name.split('_', 1)[0]);
  const duplicateTimestamps = timestamps.filter((value, index) => timestamps.indexOf(value) !== index);
  const suspiciousFiles = [];
  for (const name of entries) {
    const content = await fs.readFile(path.join(dir, name), 'utf8');
    if (secretPatterns.some((pattern) => pattern.test(content))) suspiciousFiles.push(name);
  }
  return {
    migrationCount: entries.length,
    ordered: entries.every((name, index) => index === 0 || name >= entries[index - 1]),
    duplicateTimestamps: [...new Set(duplicateTimestamps)],
    suspiciousFiles,
  };
}

async function referencedEnvNames() {
  const dirs = ['src', 'api', 'scripts'];
  const names = new Set();
  const walk = async (directory) => {
    let entries = [];
    try { entries = await fs.readdir(path.join(root, directory), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(relative);
      else if (entry.name.endsWith('.mjs')) {
        const text = await fs.readFile(path.join(root, relative), 'utf8');
        for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(match[1]);
      }
    }
  };
  for (const directory of dirs) await walk(directory);
  return [...names].sort();
}

export async function runBackupReadinessChecks() {
  const migration = await migrationChecks();
  const referenced = await referencedEnvNames();
  const docPresence = await Promise.all(requiredDocs.map(async (file) => [file, await exists(file)]));
  const missingDocs = docPresence.filter(([, present]) => !present).map(([file]) => file);
  const missingCriticalEnvReferences = requiredEnvNames.filter((name) => !referenced.includes(name));
  const checks = {
    runbookPresent: missingDocs.length === 0,
    migrationCount: migration.migrationCount > 0,
    migrationOrder: migration.ordered,
    noDuplicateMigrationTimestamps: migration.duplicateTimestamps.length === 0,
    noSecretPatternsInMigrations: migration.suspiciousFiles.length === 0,
    criticalEnvNamesReferenced: missingCriticalEnvReferences.length === 0,
  };
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    details: {
      missingDocs,
      migrationCount: migration.migrationCount,
      duplicateMigrationTimestamps: migration.duplicateTimestamps,
      suspiciousMigrationFiles: migration.suspiciousFiles,
      missingCriticalEnvReferences,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runBackupReadinessChecks();
  const json = process.argv.includes('--json');
  if (json) console.log(JSON.stringify(result));
  else {
    for (const [name, passed] of Object.entries(result.checks)) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
    console.log(`Migrations: ${result.details.migrationCount}`);
  }
  if (!result.ok) process.exitCode = 1;
}

