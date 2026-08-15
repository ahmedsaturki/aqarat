import { buildStrategy } from './strategy-framework.mjs';

const ANGLES = {
  value: { key: 'value', label: 'القيمة', hooks: ['فرصة تستحق المقارنة', 'خيار عملي لمن يبحث عن قيمة واضحة'] },
  location: { key: 'location', label: 'الموقع', hooks: ['الموقع هنا يستحق الانتباه', 'موقع يستحق الدراسة قبل اتخاذ القرار'] },
  investment: { key: 'investment', label: 'الاستثمار', hooks: ['اختيار يستحق الدراسة الاستثمارية', 'فرصة للمقارنة لمن يفكر بعقلية استثمارية'] },
  use_case: { key: 'use_case', label: 'الاستخدام', hooks: ['خيار يمكن توظيفه حسب هدفك', 'مناسب لمن يبحث عن استخدام واضح'] },
  scarcity: { key: 'scarcity', label: 'الندرة', hooks: ['المتاح الآن يستحق المراجعة', 'الفرص المشابهة قد تختلف في التفاصيل والتوقيت'] },
  certainty: { key: 'certainty', label: 'الوضوح والثقة', hooks: ['قرار أفضل يبدأ من معلومات واضحة', 'مقارنة أفضل تبدأ من بيانات يمكن التحقق منها'] },
  clarity: { key: 'clarity', label: 'الوضوح', hooks: ['بيانات أساسية واضحة تساعدك على المقارنة', 'ابدأ القرار من معلومات مؤكدة'] },
};

const CHANNEL_TONES = {
  telegram: { cta: 'للتفاصيل والتفاوض تواصل مع لارا للتسويق العقاري.', rhythm: 'direct' },
  website: { cta: 'اطلب التفاصيل والتقييم المناسب لاحتياجك من لارا للتسويق العقاري.', rhythm: 'informative' },
  facebook: { cta: 'ابعت لنا رسالة لمعرفة التفاصيل والعروض المتاحة.', rhythm: 'conversational' },
  whatsapp: { cta: 'للتفاصيل والتنسيق تواصل مع لارا للتسويق العقاري.', rhythm: 'concise' },
  linkedin: { cta: 'للتفاصيل والتواصل المهني، تواصل مع لارا للتسويق العقاري.', rhythm: 'professional' },
  classified: { cta: 'للتفاصيل والتواصل تواصل مع لارا للتسويق العقاري.', rhythm: 'concise' },
};

const RISK_REDUCERS = [
  'اسأل عن المستندات والتفاصيل قبل اتخاذ القرار.',
  'قارن الموقع والسعر والاستخدام مع البدائل قبل التفاوض.',
  'المعلومات المنشورة مبنية على البيانات المتاحة وتحتاج مراجعة قبل الإتمام.',
];

function n(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }
function has(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }

export function chooseMarketingAngle(entity = {}, context = {}) {
  const explicit = String(context.preferred_angle || '').trim().toLowerCase();
  if (ANGLES[explicit]) return { ...ANGLES[explicit], reason: 'explicit' };
  const strategy = buildStrategy(entity, context.signal || {}, context);
  const selected = strategy.angles.find((key) => ANGLES[key]);
  return selected ? { ...ANGLES[selected], reason: 'strategy_framework' } : { ...ANGLES.clarity, reason: 'fallback' };
}

export function buildPersuasionPlan(entity = {}, context = {}) {
  const channel = String(context.channel || 'telegram').toLowerCase();
  const tone = CHANNEL_TONES[channel] ?? CHANNEL_TONES.telegram;
  const strategy = buildStrategy(entity, context.signal || {}, context);
  const angle = chooseMarketingAngle(entity, context);
  const verifiedProof = [];

  if (n(entity.area_m2) !== null) verifiedProof.push('area');
  if (n(entity.price) !== null && has(entity.currency)) verifiedProof.push('price');
  if (has(entity.city) || has(entity.district)) verifiedProof.push('location');
  if (entity.installments_clear === true) verifiedProof.push('installments_clear');
  if (Array.isArray(context.verified_features)) verifiedProof.push(...context.verified_features.map(String));

  const objectionHandlers = verifiedProof.length === 0
    ? ['request_more_verified_details']
    : ['invite_comparison', 'reduce_decision_risk', 'clarify_next_step'];

  const urgency = context.verified_deadline || context.verified_availability === 'limited' ? 'fact_based' : 'none';

  return {
    channel,
    tone: tone.rhythm,
    audience: strategy.audience,
    funnel_stage: strategy.funnel_stage,
    angle,
    selected_angles: strategy.angles,
    hook: angle.hooks[0],
    proof_points: [...new Set(verifiedProof)],
    objection_handlers: objectionHandlers,
    urgency,
    decision_devices: ['benefit_first_framing', 'proof_before_claim', 'comparison_prompt', 'low_friction_cta'],
    trust_devices: ['verified_facts', 'clear_next_step', 'local_expertise', 'no_private_seller_data'],
    cta: tone.cta,
    risk_reducer: RISK_REDUCERS[verifiedProof.length % RISK_REDUCERS.length],
    guardrails: strategy.prohibited_tactics,
  };
}

export function renderSalesFramework(entity = {}, context = {}) {
  const plan = buildPersuasionPlan(entity, context);
  const city = entity.city || 'مدينة السادات';
  const district = entity.district || entity.neighborhood || null;
  const type = String(entity.property_type || entity.entity_type || '').toLowerCase() === 'land' ? 'قطعة أرض' : 'عقار';
  const facts = [];
  if (district) facts.push(`📍 ${district}`);
  if (has(entity.area_m2)) facts.push(`📐 ${entity.area_m2} م²`);
  if (has(entity.price)) facts.push(`💰 ${new Intl.NumberFormat('ar-EG').format(entity.price)} ${entity.currency === 'EGP' ? 'جنيه' : entity.currency || ''}`.trim());
  if (entity.installments_clear === true) facts.push('✅ خالصة الأقساط وفق البيانات المتاحة');

  const lines = [`🔥 ${plan.hook}`, `فرصة ${type} في ${city}`, ...facts, '', plan.risk_reducer, plan.cta];
  return { body: lines.join('\n'), plan };
}
