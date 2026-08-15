const PROPERTY_TYPES = new Set(['residential','commercial','land','apartment','villa','house','shop','office']);

function firstNonEmpty(...values) {
  return values.find((value) => value !== null && value !== undefined && String(value).trim() !== '') ?? null;
}

function textOf(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizePhone(value) {
  const raw = textOf(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (/^01\d{9}$/.test(digits)) return `+2${digits}`;
  if (/^201\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

function extractFromJsonLd(jsonLd = []) {
  const items = Array.isArray(jsonLd) ? jsonLd : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    if (Array.isArray(item['@graph'])) return item['@graph'];
    return [item];
  });
}

function hasListingSignals({ title = '', description = '', text = '' } = {}) {
  const combined = `${title} ${description} ${text}`.toLowerCase();
  const semantic = /(للبيع|للإيجار|for sale|for rent|property|apartment|villa|land|ارض|أرض|شقة|فيلا|محل|مكتب)/i.test(combined);
  const numeric = /(\d{2,}|\b(مليون|million|m2|sqm|متر|م²|جنيه|egp)\b)/i.test(combined);
  const transaction = /(للبيع|للإيجار|for sale|for rent)/i.test(combined);
  return { semantic, numeric, transaction, score: Number(semantic) + Number(numeric) + Number(transaction) };
}

export function extractCandidates(evidence) {
  const payload = evidence?.extracted_payload ?? {};
  const jsonLd = extractFromJsonLd(payload.json_ld);
  const title = textOf(payload.title);
  const text = textOf(payload.text);
  const description = textOf(payload.description);

  const propertyNodes = jsonLd.filter((item) => {
    const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : textOf(item['@type']);
    return /Residence|Apartment|House|SingleFamilyResidence|Product|Offer|Place|RealEstateListing|Accommodation/i.test(type);
  });

  const candidates = propertyNodes.map((item) => {
    const address = item.address && typeof item.address === 'object' ? item.address : {};
    const offer = item.offers && typeof item.offers === 'object' && !Array.isArray(item.offers) ? item.offers : {};
    const phone = normalizePhone(firstNonEmpty(item.telephone, item.phone, item.contactPoint?.telephone));
    const name = textOf(firstNonEmpty(item.name, title));
    const locality = textOf(firstNonEmpty(address.addressLocality, address.addressRegion));
    const priceRaw = firstNonEmpty(item.price, offer.price);

    return {
      entity_type: 'property',
      name,
      phone,
      address: textOf(address.streetAddress),
      city: locality || (/سادات|sadat city/i.test(`${title} ${text}`) ? 'Sadat City' : null),
      source_url: evidence.canonical_url || evidence.source_url || null,
      confidence: locality && /سادات|sadat city/i.test(`${title} ${description} ${text}`) ? 0.82 : 0.55,
      attributes: {
        property_type: PROPERTY_TYPES.has(textOf(item['additionalType']).toLowerCase()) ? textOf(item['additionalType']).toLowerCase() : null,
        price: priceRaw == null ? null : Number(String(priceRaw).replace(/[^\d.]/g, '')) || null,
        currency: textOf(firstNonEmpty(item.priceCurrency, offer.priceCurrency, 'EGP')),
        bedrooms: Number(item.numberOfBedrooms ?? item.bedrooms) || null,
        bathrooms: Number(item.numberOfBathrooms ?? item.bathrooms) || null,
      },
    };
  });

  if (candidates.length) return candidates;

  const sadatSignal = /سادات|sadat city|el sadat/i.test(`${title} ${description} ${text}`);
  if (!sadatSignal) return [];

  // Never promote a generic city/category/index page into a property.
  // A fallback candidate must contain listing-specific semantic/numeric evidence.
  const signals = hasListingSignals({ title, description, text });
  const fallbackPhone = normalizePhone(firstNonEmpty(payload.phone, payload.telephone));
  if (signals.score < 2 && !fallbackPhone) return [];

  return [{
    entity_type: 'property',
    name: title || null,
    phone: fallbackPhone,
    address: null,
    city: 'Sadat City',
    source_url: evidence.canonical_url || evidence.source_url || null,
    confidence: signals.transaction && signals.numeric ? 0.55 : 0.4,
    attributes: {
      extracted_without_structured_markup: true,
      listing_signals: signals,
    },
  }];
}

export { normalizePhone, hasListingSignals };
