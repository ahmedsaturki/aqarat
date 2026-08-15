import { assertPublicCopySafe } from '../content/marketing-policy.mjs';

const BLOCKED_CLAIMS = [
  'guaranteed',
  'best price',
  '100% guaranteed',
  'مضمون 100%',
  'أفضل سعر',
  'مضمون',
  'لا تعوض',
  'آخر فرصة',
  'الحق قبل فوات الأوان',
];

const RISKY_PATTERNS = [
  /\b(?:today|now|النهارده|دلوقتي)\b.{0,20}(?:only|بس|فقط)\b/iu,
  /(?:عدد محدود|وحدات محدودة|حجز عاجل|فرصة لن تتكرر)/iu,
  /(?:الناس كلها بتشتري|الجميع بيشتري|أكثر عقار مطلوب)/iu,
];

const DISALLOWED_TARGETING = [
  'بدون عائلات',
  'للمصريين فقط',
  'لغير المصريين',
  'للرجال فقط',
  'للنساء فقط',
  'بدون أطفال',
];

export function reviewContent({ body, confidence = 0, provenanceCount = 0, channel = 'telegram', entity = null }) {
  const text = String(body ?? '').trim();
  const lower = text.toLowerCase();
  const normalizedChannel = String(channel || 'telegram').toLowerCase();
  const blockers = BLOCKED_CLAIMS.filter((claim) => lower.includes(claim.toLowerCase()));
  const riskyPatterns = RISKY_PATTERNS.filter((pattern) => pattern.test(text)).map(String);
  const targetingViolations = DISALLOWED_TARGETING.filter((claim) => lower.includes(claim.toLowerCase()));

  // Review evaluates the supplied copy for leaks without forcing the direct
  // review unit to manufacture a Lara CTA. Publication/pipeline rendering
  // applies the stronger public-brand requirement before release.
  const privacy = assertPublicCopySafe(text, entity ?? {}, 'internal');
  const phoneLeakDetected = privacy.ok === false && privacy.forbidden_values?.length > 0;

  const checks = {
    non_empty: text.length > 0,
    provenance: Number(provenanceCount) > 0,
    confidence: Number(confidence) >= 0.5,
    no_blocked_claims: blockers.length === 0,
    no_fake_urgency_or_social_proof: riskyPatterns.length === 0,
    no_disallowed_targeting: targetingViolations.length === 0,
    no_private_contact_leak: !phoneLeakDetected,
    external_requires_human: !['telegram', 'website'].includes(normalizedChannel),
  };

  const coreChecksPass = Object.entries(checks)
    .filter(([key]) => key !== 'external_requires_human')
    .every(([, value]) => value === true);

  const approved = coreChecksPass && !checks.external_requires_human;
  return {
    approved,
    checks,
    blockers,
    risky_patterns: riskyPatterns,
    targeting_violations: targetingViolations,
    privacy,
    decision: approved ? 'approved' : 'needs_review',
  };
}
