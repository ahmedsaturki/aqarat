import test from 'node:test';
import assert from 'node:assert/strict';
import { runBackupReadinessChecks } from './verify-backup-readiness.mjs';

test('backup readiness checks validate local recovery prerequisites without reading secrets', async () => {
  const result = await runBackupReadinessChecks();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.details.suspiciousMigrationFiles.length, 0);
  assert.equal(result.details.duplicateMigrationTimestamps.length, 0);
  assert.ok(result.details.migrationCount > 0);
});
