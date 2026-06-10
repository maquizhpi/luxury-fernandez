import { createAdminToken, validateAdminCredentials } from '../_auth.js';
import { parseBody, sendJson } from '../_mongo.js';

// In-memory rate limiter — limits rapid bursts within a single serverless instance.
// Not shared across instances; provides basic protection against local brute force.
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo no permitido.' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return sendJson(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' });
  }

  const { username = 'admin', password } = parseBody(req);
  const user = await validateAdminCredentials(username, password);
  if (!user) return sendJson(res, 401, { error: 'Usuario o contrasena incorrectos.' });

  return sendJson(res, 200, { token: createAdminToken(user.username), username: user.username });
}
