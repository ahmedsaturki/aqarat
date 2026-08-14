import { handleTelegramUpdate } from '../../../src/runtime/vercel-handler.mjs';

export default function handler(req, res) {
  return handleTelegramUpdate(req, res);
}
