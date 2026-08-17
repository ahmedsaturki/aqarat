import test from 'node:test';
import assert from 'node:assert/strict';
import { timedFetch } from './http.mjs';

test('timedFetch passes an abort signal and returns the response', async () => {
  const previous = globalThis.fetch;
  let receivedSignal;
  try {
    globalThis.fetch = async (_url, options) => {
      receivedSignal = options.signal;
      return new Response('ok', { status: 200 });
    };
    const response = await timedFetch('https://example.test', {}, 100);
    assert.equal(response.status, 200);
    assert.equal(receivedSignal instanceof AbortSignal, true);
  } finally {
    globalThis.fetch = previous;
  }
});

test('timedFetch preserves external aborts as bounded abort errors', async () => {
  const previous = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = (_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
    const promise = timedFetch('https://example.test', { signal: controller.signal }, 100);
    controller.abort();
    await assert.rejects(() => promise, (error) => {
      assert.equal(error.message, 'outbound_request_aborted');
      assert.equal(error.code, 'ABORTED');
      return true;
    });
  } finally {
    globalThis.fetch = previous;
  }
});

test('timedFetch converts an aborted request into a bounded timeout error', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = (_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
    await assert.rejects(() => timedFetch('https://example.test', {}, 5), (error) => {
      assert.equal(error.message, 'outbound_request_timeout');
      return true;
    });
  } finally {
    globalThis.fetch = previous;
  }
});
