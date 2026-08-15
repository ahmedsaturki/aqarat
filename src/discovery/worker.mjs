// Compatibility entrypoint kept for older callers.
// The canonical production discovery worker is worker-http.mjs.
import { runDiscoveryOnce } from './worker-http.mjs';

export { runDiscoveryOnce };

const result = await runDiscoveryOnce();
if (result && result.ok === false) process.exitCode = 1;
