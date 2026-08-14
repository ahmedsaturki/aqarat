import { URL } from 'node:url';

function hostnameMatches(hostname, allowedDomains) {
  return allowedDomains.some((domain) => {
    const normalized = String(domain || '').toLowerCase().trim().replace(/^\.+/, '');
    const host = hostname.toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

export function assertDiscoverySourceAllowed(source, targetUrl) {
  const policy = source?.crawl_policy ?? {};

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
  if (policy.require_permission_reference === true && !source.metadata?.permission_reference) {
    throw new Error('discovery_permission_reference_required');
  }

  return true;
}
