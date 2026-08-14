import { createHash } from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function abortAfter(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    try {
      const value = JSON.parse(match[1].trim());
      if (Array.isArray(value)) out.push(...value);
      else out.push(value);
    } catch {
      // Keep raw source evidence even when individual JSON-LD blocks are malformed.
    }
  }
  return out;
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  return html.match(re)?.[1] ?? null;
}

function assertPublicHttpUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported_url_scheme');
  if (url.username || url.password) throw new Error('credentials_in_url_not_allowed');
  return url;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export async function fetchPublicSource(url, options = {}) {
  const target = assertPublicHttpUrl(url);
  const timeoutMs = Math.min(Number(options.timeoutMs || DEFAULT_TIMEOUT_MS), 30000);
  const { signal, clear } = abortAfter(timeoutMs);

  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal,
      headers: {
        'user-agent': options.userAgent || 'AqaratOS/1.0 (+public-discovery)',
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) throw new Error(`source_http_${response.status}`);
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('unsupported_content_type');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('source_body_unavailable');
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('source_response_too_large');
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const html = new TextDecoder().decode(bytes);
    const canonical = metaContent(html, 'og:url') || response.url || target.href;

    return {
      source_url: target.href,
      canonical_url: canonical,
      fetched_at: new Date().toISOString(),
      status: 'discovered',
      content_hash: sha256(html),
      extracted_payload: {
        title: metaContent(html, 'og:title') || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null,
        description: metaContent(html, 'description') || metaContent(html, 'og:description'),
        image: metaContent(html, 'og:image'),
        json_ld: extractJsonLd(html),
        text: stripHtml(html).slice(0, 50000),
      },
    };
  } finally {
    clear();
  }
}

export { extractJsonLd, stripHtml, sha256 };
