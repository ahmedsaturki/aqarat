function durationMs(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function roundDuration(value) {
  return Math.round(value * 100) / 100;
}

function writeEvent(level, event, payload) {
  const logger = level === 'error' ? console.error : console.info;
  logger(JSON.stringify({ event, ...payload }));
}

export function installResponseTelemetry(req, res, { route, correlationId } = {}) {
  const startedAt = process.hrtime.bigint();
  const method = String(req?.method || 'UNKNOWN').toUpperCase();
  const normalizedRoute = String(route || 'unknown').slice(0, 160);
  let completed = false;

  writeEvent('info', 'api_request_started', {
    method,
    route: normalizedRoute,
    correlation_id: correlationId,
  });

  const originalEnd = res.end;
  res.end = function responseEnd(...args) {
    if (!completed) {
      completed = true;
      const elapsed = roundDuration(durationMs(startedAt));
      const status = Number(this.statusCode || 200);
      const body = args[0];
      const responseBytes = typeof body === 'string' || Buffer.isBuffer(body) ? Buffer.byteLength(body) : undefined;
      this.setHeader?.('server-timing', `aqarat;dur=${elapsed}`);
      this.setHeader?.('x-response-time-ms', String(elapsed));
      writeEvent('info', 'api_request_completed', {
        method,
        route: normalizedRoute,
        status,
        duration_ms: elapsed,
        ...(responseBytes == null ? {} : { response_bytes: responseBytes }),
        correlation_id: correlationId,
      });
    }
    return originalEnd.apply(this, args);
  };

  return () => roundDuration(durationMs(startedAt));
}

export function logStructuredError(event, payload = {}) {
  writeEvent('error', event, payload);
}
