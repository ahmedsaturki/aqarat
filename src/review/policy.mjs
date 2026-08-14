const BLOCKED_CLAIMS = [
  'guaranteed',
  'best price',
  '100% guaranteed',
  'مضمون 100%',
  'أفضل سعر',
];

export function reviewContent({ body, confidence = 0, provenanceCount = 0, channel = 'telegram' }) {
  const text = String(body ?? '').toLowerCase();
  const blockers = BLOCKED_CLAIMS.filter((claim) => text.includes(claim.toLowerCase()));
  const checks = {
    non_empty: text.trim().length > 0,
    provenance: provenanceCount > 0,
    confidence: Number(confidence) >= 0.5,
    no_blocked_claims: blockers.length === 0,
    external_requires_human: !['telegram', 'website'].includes(channel),
  };
  const approved = Object.values(checks).every(Boolean);
  return { approved, checks, blockers, decision: approved ? 'approved' : 'needs_review' };
}
