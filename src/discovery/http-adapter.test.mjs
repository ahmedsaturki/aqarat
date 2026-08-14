import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonLd, stripHtml } from './http-adapter.mjs';

test('extractJsonLd parses objects and arrays', () => {
  const html = `
    <script type="application/ld+json">{"@type":"Product","name":"A"}</script>
    <script type="application/ld+json">[{"@type":"Thing","name":"B"}]</script>
  `;
  assert.deepEqual(extractJsonLd(html), [
    { '@type': 'Product', name: 'A' },
    { '@type': 'Thing', name: 'B' },
  ]);
});

test('stripHtml removes executable content and normalizes whitespace', () => {
  assert.equal(stripHtml('<script>alert(1)</script><h1>Aqarat</h1>  City &amp; More'), 'Aqarat City & More');
});

test('discovery adapter source code enforces credential-free public URLs', async () => {
  const { fetchPublicSource } = await import('./http-adapter.mjs');
  await assert.rejects(() => fetchPublicSource('https://user:pass@example.com'), /credentials_in_url_not_allowed/);
  await assert.rejects(() => fetchPublicSource('file:///tmp/x'), /unsupported_url_scheme/);
});
