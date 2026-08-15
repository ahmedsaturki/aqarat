import { handleIntake } from '../runtime/vercel-handler.mjs';

export default function handler(req, res) {
  return handleIntake(req, res);
}
