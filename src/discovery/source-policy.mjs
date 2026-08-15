import { URL } from 'node:url';

function hostnameMatches(hostname, allowedDomains) {
  return allowedDomains.some((domain) => {
    const normalized = String(domain || '').toLowerCase().trim().replace(/^\.+/, '');
    const host = hostname.toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function hasActivePermissionEvidence(evidence, now = Date.now()) {
  if (evidence === true) return true;
  const status = String(evidence?.status || '').trim().toLowerCase();
  if (!['verified', 'approved'].includes(status)) return false;
  if (!evidence?.verified_at || Number.isNaN(Date.parse(evidence.verified_at))) return false;
  if (evidence?.expires_at && (!Number.isNaN(Date.parse(evidence.expires_at)) && Date.parse(evidence.expires_at) <= now)) return false;
  return true;
}

export function assertDiscoverySourceAllowed(source, targetUrl, permissionEvidence = null) {
  const policy = source?.crawl_policy ?? source?.config ?? {};

  if (!source?.enabled) throw new Error('discovery_source_not_enabled');
  if (policy.automation_allowed !== true) {
    throw new Error('discovery_source_policy_blocked');
  }

  let url;
  try {
    url = new URL(String(targetUrl || ''));
  } catch {
    throw new Error('discovery_target_url_invalid');
  }

  if (url.protocol !== 'https:') throw new Error('discovery_https_required');
  if (!hostnameMatches(url.hostname, Array.isArray(policy.allowed_domains) ? policy.allowed_domains : [])) {
    throw new Error('discovery_domain_not_allowlisted');
  }

  if (url.username || url.password) throw new Error('discovery_url_credentials_forbidden');

  const permissionReference = source?.metadata?.permission_reference ?? policy.permission_reference;
  if (policy.require_permission_reference === true && !permissionReference) {
    throw new Error('discovery_permission_reference_required');
  }
  if (policy.require_permission_reference === true && !hasActivePermissionEvidence(permissionEvidence)) {
    throw new Error('discovery_permission_evidence_required');
  }

  return true;
}
