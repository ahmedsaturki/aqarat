export function buildSourceRegistration({ key, name, baseUrl, policyMode = 'explicit_permission', allowedDomains = [], permissionReference = null, enabled = false, metadata = {} }) {
  if (!key || !name || !baseUrl) throw new Error('source_registration_required');
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') throw new Error('source_https_required');
  return {
    key,
    name,
    base_url: url.toString(),
    enabled,
    policy_mode: policyMode,
    config: {
      automation_allowed: Boolean(enabled && permissionReference),
      allowed_domains: allowedDomains,
      require_permission_reference: true,
    },
    metadata: {
      ...metadata,
      permission_reference: permissionReference,
    },
  };
}

export function buildManualSource({ key, name, baseUrl, permissionReference, metadata = {} }) {
  return buildSourceRegistration({
    key,
    name,
    baseUrl,
    permissionReference,
    metadata: { ...metadata, source_mode: 'manual_or_owner_controlled' },
    policyMode: 'manual_or_owner_controlled',
    enabled: false,
    allowedDomains: [new URL(baseUrl).hostname],
  });
}
