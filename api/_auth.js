import crypto from 'node:crypto';

const adminPassword = process.env.ADMIN_PASSWORD || 'luxury2025';
const tokenSecret = process.env.ADMIN_TOKEN_SECRET || adminPassword;

function sign(value) {
  return crypto.createHmac('sha256', tokenSecret).update(value).digest('hex');
}

export function createAdminToken() {
  const payload = JSON.stringify({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 });
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

export function requireAdmin(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (verifyAdminToken(token)) return true;
  res.status(401).json({ error: 'Sesion de administrador requerida.' });
  return false;
}
