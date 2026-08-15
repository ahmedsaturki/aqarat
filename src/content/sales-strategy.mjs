const ANGLES = {
  value: {
    key: 'value',
    label: 'القيمة',
    hooks: ['فرصة تستحق المقارنة', 'خيار عملي لمن يبحث عن قيمة واضحة'],
  },
  location: {
    key: 'location',
    label: 'الموقع',
    hooks: ['الموقع أول ما يلفت الانتباه هنا', 'موقع يستحق النظر قبل اتخاذ القرار'],
  },
  investment: {
    key: 'investment',
    label: 'الاستثمار',
    hooks: ['اختيار يستحق الدراسة الاستثمارية', 'فرصة للمقارنة لمن يفكر بعقلية استثمارية'],
  },
  use_case: {
    key: 'use_case',
    label: 'الاستخدام',
    hooks: ['مناسب لمن يبحث عن استخدام واضح ومحدد', 'خيار يمكن البناء عليه حسب هدفك'],
  },
  scarcity: {
    key: 'scarcity',
    label: 'الندرة',
    hooks: ['المتاح الآن يستحق أن يُراجع سريعًا', 'الفرص المشابهة قد تختلف في التفاصيل والتوقيت'],
  },
  clarity: {
    key: 'clarity',
    label: 'الوضوح',
    hooks: ['بيانات أساسية واضحة تساعدك على المقارنة', 'قرار أفضل يبدأ من معلومات مؤكدة'],
  },
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
  'قارن السعر والموقع والاستخدام مع البدائل قبل التفاوض.',
  'المعلومات المنشورة مبنية على البيانات المتاحة وتحتاج مراجعة قبل الإتمام.',
];

function n(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function has(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function chooseMarketingAngle(entity = {}, context = {}) {
  const explicit = String(context.preferred_angle || '').trim().toLowerCase();
  if (ANGLES[explicit]) return { ...ANGLES[explicit], reason: 'explicit' };

  const area = n(entity.area_m2);
  const price = n(entity.price);
  const hasLocation = has(entity.city) || has(entity.district) || has(entity.neighborhood);
  const type = String(entity.property_type || entity.entity_type || '').toLowerCase();

  if (has(entity.district) || has(entity.neighborhood)) return { ...ANGLES.location, reason: 'location_signal' };
  if (type.includes('land') && price !== null && area !== null) return { ...ANGLES.investment, reason: 'land_plus_price_plus_area' };
  if (area !== null && price !== null) return { ...ANGLES.value, reason: 'value_comparable_fields' };
  if (hasLocation) return { ...ANGLES.clarity, reason: 'location_only' };
  return { ...ANGLES.clarity, reason: 'fallback' };
}

export function buildPersuasionPlan(entity = {}, context = {}) {
  const channel = String(context.channel || 'telegram').toLowerCase();
  const tone = CHANNEL_TONES[channel] ?? CHANNEL_TONES.telegram;
  const angle = chooseMarketingAngle(entity, context);
  const verifiedProof = [];

  if (n(entity.area_m2) !== null) verifiedProof.push('area');
  if (n(entity.price) !== null && has(entity.currency)) verifiedProof.push('price');
  if (has(entity.city) || has(entity.district)) verifiedProof.push('location');
  if (entity.installments_clear === true) verifiedProof.push('installments_clear');
  if (Array.isArray(context.verified_features)) verifiedProof.push(...context.verified_features.map(String));

  const objectionHandlers = [];
  if (verifiedProof.length === 0) objectionHandlers.push('request_more_verified_details');
  else objectionHandlers.push('invite_comparison', 'reduce_decision_risk');

  const urgency = context.verified_deadline || context.verified_availability === 'limited'
    ? 'fact_based'
    : 'none';

  return {
    channel,
    tone: tone.rhythm,
    angle,
    hook: angle.hooks[0],
    proof_points: [...new Set(verifiedProof)],
    objection_handlers: objectionHandlers,
    urgency,
    trust_devices: ['verified_facts', 'clear_next_step', 'no_private_seller_data'],
    cta: tone.cta,
    risk_reducer: RISK_REDUCERS[verifiedProof.length % RISK_REDUCERS.length],
    guardrails: [
      'no_fabricated scarcity',
      'no fake social proof',
      'no guaranteed outcome claims',
      'no private seller/office contact details',
      'no discrimination or exclusionary targeting',
    ],
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

  const lines = [
    `🔥 ${plan.hook}`,
    `فرصة ${type} في ${city}`,
    ...facts,
    '',
    plan.risk_reducer,
    plan.cta,
  ];

  return { body: lines.join('\n'), plan };
}
