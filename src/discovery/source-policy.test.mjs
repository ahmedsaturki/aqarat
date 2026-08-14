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
