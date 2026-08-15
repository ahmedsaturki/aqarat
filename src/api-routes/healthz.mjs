import { handleHealth } from '../runtime/vercel-handler.mjs';

export default function handler(req, res) {
  return handleHealth(req, res);
}
