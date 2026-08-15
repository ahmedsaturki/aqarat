function norm(value) {
  return String(value ?? '').toLowerCase().normalize('NFKC').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function phoneKey(value) {
  return String(value ?? '').replace(/\D/g, '').replace(/^20/, '').replace(/^0/, '');
}

function similarity(a, b) {
  const aa = norm(a);
  const bb = norm(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return 0.88;
  const as = new Set(aa.split(' '));
  const bs = new Set(bb.split(' '));
  const intersection = [...as].filter((x) => bs.has(x)).length;
  return intersection / Math.max(as.size, bs.size);
}

function relativeDifference(a, b) {
  const aa = num(a);
  const bb = num(b);
  if (aa == null || bb == null) return null;
  return Math.abs(aa - bb) / Math.max(Math.abs(aa), Math.abs(bb), 1);
}

export function scorePropertyMatch(a, b) {
  const reasons = [];
  let score = 0;

  const typeA = norm(a?.property_type ?? a?.type);
  const typeB = norm(b?.property_type ?? b?.type);
  const txA = norm(a?.transaction_type ?? a?.transaction);
  const txB = norm(b?.transaction_type ?? b?.transaction);
  const cityA = norm(a?.city);
  const cityB = norm(b?.city);
  const districtA = norm(a?.district);
  const districtB = norm(b?.district);
  const parcelA = num(a?.parcel_number);
  const parcelB = num(b?.parcel_number);

  const pa = phoneKey(a?.phone ?? a?.primary_phone);
  const pb = phoneKey(b?.phone ?? b?.primary_phone);
  if (pa && pb && pa === pb) {
    score += 0.55;
    reasons.push('same_phone');
  }

  if (parcelA != null && parcelB != null && parcelA === parcelB && cityA && cityA === cityB && typeA === typeB) {
    score += 0.35;
    reasons.push('same_parcel_city_type');
  }

  const areaDiff = relativeDifference(a?.area_m2, b?.area_m2);
  if (areaDiff != null && areaDiff <= 0.01) {
    score += 0.15;
    reasons.push('same_area');
  } else if (areaDiff != null && areaDiff <= 0.03) {
    score += 0.08;
    reasons.push('near_area');
  }

  const priceDiff = relativeDifference(a?.price, b?.price);
  if (priceDiff != null && priceDiff <= 0.02) {
    score += 0.10;
    reasons.push('same_price');
  } else if (priceDiff != null && priceDiff <= 0.05) {
    score += 0.05;
    reasons.push('near_price');
  }

  if (cityA && cityB && cityA === cityB) {
    score += 0.05;
    reasons.push('same_city');
  }

  if (districtA && districtB && districtA === districtB) {
    score += 0.08;
    reasons.push('same_district');
  }

  if (typeA && typeB && typeA === typeB) {
    score += 0.05;
    reasons.push('same_property_type');
  }

  if (txA && txB && txA === txB) {
    score += 0.05;
    reasons.push('same_transaction_type');
  }

  const address = similarity(a?.address, b?.address);
  if (address >= 0.85) {
    score += 0.12;
    reasons.push('same_address');
  }

  const name = similarity(a?.name, b?.name);
  if (name >= 0.9) {
    score += 0.05;
    reasons.push('same_name');
  }

  return { score: Math.min(score, 1), reasons };
}

export function chooseCanonical(candidates) {
  return [...candidates].sort((a, b) => {
    const score = Number(b?.confidence ?? 0) - Number(a?.confidence ?? 0);
    if (score !== 0) return score;
    const completenessA = Object.values(a ?? {}).filter((v) => v !== null && v !== undefined && v !== '').length;
    const completenessB = Object.values(b ?? {}).filter((v) => v !== null && v !== undefined && v !== '').length;
    if (completenessB !== completenessA) return completenessB - completenessA;
    return String(a?.source_url ?? '').localeCompare(String(b?.source_url ?? ''));
  })[0] ?? null;
}
