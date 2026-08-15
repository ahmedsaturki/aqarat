import { assertPublicCopySafe } from '../content/marketing-policy.mjs';

const BLOCKED_CLAIMS = [
  'guaranteed',
  'best price',
  '100% guaranteed',
  'مضمون 100%',
  'أفضل سعر',
];

export function reviewContent({ body, confidence = 0, provenanceCount = 0, channel = 'telegram', entity = null }) {
  const text = String(body ?? '').toLowerCase();
  const normalizedChannel = String(channel || 'telegram').toLowerCase();
  const blockers = BLOCKED_CLAIMS.filter((claim) => text.includes(claim.toLowerCase()));
  const privacy = assertPublicCopySafe(body, entity ?? {}, normalizedChannel);
  const checks = {
    non_empty: text.trim().length > 0,
    provenance: Number(provenanceCount) > 0,
    confidence: Number(confidence) >= 0.5,
    no_blocked_claims: blockers.length === 0,
    no_private_contact_leak: privacy.ok,
    external_requires_human: !['telegram', 'website'].includes(normalizedChannel),
  };
  const coreChecksPass = checks.non_empty && checks.provenance && checks.confidence && checks.no_blocked_claims && checks.no_private_contact_leak;
  const approved = coreChecksPass && !checks.external_requires_human;
  return { approved, checks, blockers, privacy, decision: approved ? 'approved' : 'needs_review' };
}
