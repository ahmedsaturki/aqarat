import fs from 'node:fs';

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
if (vercel.rewrites.some((rule) => rule.source === '/')) throw new Error('root rewrite still present');
for (const file of ['index.html', 'robots.txt', 'sitemap.xml']) {
  if (!fs.existsSync(file)) throw new Error(`${file} missing`);
}
const html = fs.readFileSync('index.html', 'utf8');
for (const token of ['canonical', 'application/ld+json', '/dashboard', 'lang="ar"', 'dir="rtl"']) {
  if (!html.includes(token)) throw new Error(`${token} missing`);
}
const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
if (canonical !== 'https://aqarat-eg.vercel.app/') throw new Error('canonical must target production root');
const jsonLd = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/i)?.[1];
if (!jsonLd) throw new Error('JSON-LD payload missing');
const structured = JSON.parse(jsonLd);
if (structured['@context'] !== 'https://schema.org' || structured['@type'] !== 'Organization') {
  throw new Error('JSON-LD organization contract invalid');
}
const robots = fs.readFileSync('robots.txt', 'utf8');
for (const rule of ['Disallow: /dashboard', 'Disallow: /api/', 'Sitemap: https://aqarat-eg.vercel.app/sitemap.xml']) {
  if (!robots.includes(rule)) throw new Error(`${rule} missing`);
}
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
if (!sitemap.includes('<loc>https://aqarat-eg.vercel.app/</loc>')) throw new Error('production root missing from sitemap');
if (/<loc>[^<]*(dashboard|api)[^<]*<\/loc>/i.test(sitemap)) throw new Error('private path leaked into sitemap');
console.log('public SEO assets: valid');
