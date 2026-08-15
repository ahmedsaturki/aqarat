import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDiscoverySourceAllowed } from './source-policy.mjs';

test('blocks automation when source policy is absent', () => {
  assert.throws(
    () => assertDiscoverySourceAllowed({ enabled: true, crawl_policy: {}, metadata: {} }, 'https://example.com/listings'),
    /discovery_source_policy_blocked/,
  );
});

test('requires an explicit domain allowlist', () => {
  const source = {
    enabled: true,
    crawl_policy: { automation_allowed: true, allowed_domains: ['example.com'] },
    metadata: {},
  };

  assertDiscoverySourceAllowed(source, 'https://example.com/listings');
  assert.throws(
    () => assertDiscoverySourceAllowed(source, 'https://evil.example.net/listings'),
    /discovery_domain_not_allowlisted/,
  );
});

test('requires HTTPS and rejects embedded credentials', () => {
  const source = {
    enabled: true,
    crawl_policy: { automation_allowed: true, allowed_domains: ['example.com'] },
    metadata: {},
  };

  assert.throws(
    () => assertDiscoverySourceAllowed(source, 'http://example.com/listings'),
    /discovery_https_required/,
  );
  assert.throws(
    () => assertDiscoverySourceAllowed(source, 'https://user:pass@example.com/listings'),
    /discovery_url_credentials_forbidden/,
  );
});

test('permission-required sources fail closed without a reference', () => {
  const source = {
    enabled: true,
    crawl_policy: {
      automation_allowed: true,
      allowed_domains: ['example.com'],
      require_permission_reference: true,
    },
    metadata: {},
  };

  assert.throws(
    () => assertDiscoverySourceAllowed(source, 'https://example.com/listings'),
    /discovery_permission_reference_required/,
  );
});

test('permission-required sources require current verified or approved evidence', () => {
  const source = {
    enabled: true,
    crawl_policy: {
      automation_allowed: true,
      allowed_domains: ['example.com'],
      require_permission_reference: true,
    },
    metadata: { permission_reference: 'OPS-2026-001' },
  };

  assert.throws(
    () => assertDiscoverySourceAllowed(source, 'https://example.com/listings'),
    /discovery_permission_evidence_required/,
  );
  assert.throws(
    () => assertDiscoverySourceAllowed(source, 'https://example.com/listings', {
      status: 'approved', verified_at: '2026-08-01T00:00:00Z', expires_at: '2026-08-10T00:00:00Z',
    }),
    /discovery_permission_evidence_required/,
  );
  assert.doesNotThrow(() => assertDiscoverySourceAllowed(source, 'https://example.com/listings', {
    status: 'verified', verified_at: '2026-08-01T00:00:00Z', expires_at: '2026-12-31T00:00:00Z',
  }));
  assert.doesNotThrow(() => assertDiscoverySourceAllowed(source, 'https://example.com/listings', true));
});
