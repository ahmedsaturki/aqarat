import { getPublicBrandConfig } from '../config/public-brand.mjs';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET').json({ error: 'method_not_allowed' });
    return;
  }

  const config = getPublicBrandConfig();
  res.status(200).json({
    brand: config.brand,
    phone: config.phone,
    whatsapp: config.whatsapp,
    website: config.website,
    public_price_policy: 'never_publish_internal_price',
  });
}
