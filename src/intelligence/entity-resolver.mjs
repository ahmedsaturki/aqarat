function norm(value) {
  return String(value ?? '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
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

export function scorePropertyMatch(a, b) {
  const reasons = [];
  let score = 0;

  const pa = phoneKey(a?.phone);
  const pb = phoneKey(b?.phone);
  if (pa && pb && pa === pb) {
    score += 0.65;
    reasons.push('same_phone');
  }

  const address = similarity(a?.address, b?.address);
  if (address >= 0.85) {
    score += 0.2;
    reasons.push('same_address');
  }

  const cityA = norm(a?.city);
  const cityB = norm(b?.city);
  if (cityA && cityB && cityA === cityB) {
    score += 0.05;
    reasons.push('same_city');
  }

  const name = similarity(a?.name, b?.name);
  if (name >= 0.9) {
    score += 0.1;
    reasons.push('same_name');
  }

  return { score: Math.min(score, 1), reasons };
}

export function chooseCanonical(candidates) {
  return [...candidates].sort((a, b) => {
    const score = Number(b?.confidence ?? 0) - Number(a?.confidence ?? 0);
    if (score !== 0) return score;
    return String(a?.source_url ?? '').localeCompare(String(b?.source_url ?? ''));
  })[0] ?? null;
}
