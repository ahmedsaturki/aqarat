import { OUTBOUND_TIMEOUT_MS } from './runtime-config.mjs';

function combinedSignal(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const abortFromExternal = () => controller.abort(externalSignal?.reason || 'aborted');
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    },
  };
}

export async function timedFetch(url, options = {}, timeoutMs = OUTBOUND_TIMEOUT_MS) {
  const boundedTimeout = Math.max(1, Number(timeoutMs) || OUTBOUND_TIMEOUT_MS);
  const request = combinedSignal(options.signal, boundedTimeout);
  try {
    return await fetch(url, { ...options, signal: request.signal });
  } catch (error) {
    if (error?.name === 'AbortError' || request.signal.aborted) {
      const timeoutError = new Error(request.signal.reason === 'timeout' ? 'outbound_request_timeout' : 'outbound_request_aborted');
      timeoutError.code = request.signal.reason === 'timeout' ? 'TIMEOUT' : 'ABORTED';
      timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    request.cleanup();
  }
}
