import { createAdminToken, validateAdminCredentials } from '../_auth.js';
import { parseBody, sendJson } from '../_mongo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo no permitido.' });

  const { username = 'admin', password } = parseBody(req);
  const user = await validateAdminCredentials(username, password);
  if (!user) return sendJson(res, 401, { error: 'Usuario o contrasena incorrectos.' });

  return sendJson(res, 200, { token: createAdminToken(user.username), username: user.username });
}
