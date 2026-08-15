const DEFAULT_BRAND = 'لارا للتسويق العقاري';
const DEFAULT_PHONE = '01000925451';

function clean(value) {
  return String(value ?? '').trim();
}

export function getPublicBrandConfig(env = process.env) {
  const brand = clean(env.PUBLIC_MARKETING_BRAND) || DEFAULT_BRAND;
  const phone = clean(env.PUBLIC_MARKETING_PHONE) || clean(env.PUBLIC_MARKETING_WHATSAPP) || DEFAULT_PHONE;
  const whatsapp = clean(env.PUBLIC_MARKETING_WHATSAPP) || phone;
  const website = clean(env.PUBLIC_MARKETING_WEBSITE);

  return Object.freeze({
    brand,
    phone,
    whatsapp,
    website,
  });
}

export const PUBLIC_BRAND_DEFAULTS = Object.freeze({
  brand: DEFAULT_BRAND,
  phone: DEFAULT_PHONE,
  whatsapp: DEFAULT_PHONE,
  website: '',
});
