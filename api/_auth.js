import crypto from 'node:crypto';
import { getUsersCollection } from './_mongo.js';

const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'luxury2025';
const tokenSecret = process.env.ADMIN_TOKEN_SECRET || adminPassword;
const iterations = 210000;
const keyLength = 32;
const digest = 'sha256';

function sign(value) {
  return crypto.createHmac('sha256', tokenSecret).update(value).digest('hex');
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest).toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash = '') {
  const [scheme, rawIterations, salt, hash] = storedHash.split('$');
  if (scheme !== 'pbkdf2' || !rawIterations || !salt || !hash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, Number(rawIterations), keyLength, digest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
}

export function createAdminToken(username = adminUser) {
  const payload = JSON.stringify({ role: 'admin', username, exp: Date.now() + 1000 * 60 * 60 * 12 });
  const encoded = Buffer.from(payload).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminToken(token = '') {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature || sign(encoded) !== signature) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function isAdminPassword(password) {
  return password === adminPassword;
}

export async function validateAdminCredentials(username, password) {
  const normalized = String(username || '').trim().toLowerCase();

  try {
    const users = await getUsersCollection();
    const user = await users.findOne({ username: normalized, active: { $ne: false } });
    if (user?.passwordHash && verifyPassword(password, user.passwordHash)) return user;
  } catch (error) {
    console.warn(error);
  }

  // Timing-safe comparison to prevent timing oracle attacks on the env fallback
  const userMatch = crypto.timingSafeEqual(
    Buffer.from(normalized.padEnd(64)),
    Buffer.from(adminUser.padEnd(64))
  );
  const passMatch = crypto.timingSafeEqual(
    Buffer.from(String(password || '').padEnd(128)),
    Buffer.from(adminPassword.padEnd(128))
  );
  if (userMatch && passMatch) {
    return { username: adminUser, role: 'admin' };
  }

  return null;
}

export function requireAdmin(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (verifyAdminToken(token)) return true;
  res.status(401).json({ error: 'Sesion de administrador requerida.' });
  return false;
}
