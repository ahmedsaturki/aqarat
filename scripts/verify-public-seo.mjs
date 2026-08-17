import fs from 'node:fs';

const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
if (vercel.rewrites.some((rule) => rule.source === '/')) throw new Error('root rewrite still present');
for (const file of ['index.html', 'robots.txt', 'sitemap.xml']) {
  if (!fs.existsSync(file)) throw new Error(`${file} missing`);
}
const html = fs.readFileSync('index.html', 'utf8');
for (const token of ['canonical', 'application/ld+json', '/dashboard']) {
  if (!html.includes(token)) throw new Error(`${token} missing`);
}
if (!fs.readFileSync('robots.txt', 'utf8').includes('Disallow: /dashboard')) throw new Error('dashboard must remain disallowed');
console.log('public SEO assets: valid');
