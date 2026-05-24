import { createAdminToken, isAdminPassword } from '../_auth.js';
import { parseBody, sendJson } from '../_mongo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metodo no permitido.' });

  const { password } = parseBody(req);
  if (!isAdminPassword(password)) return sendJson(res, 401, { error: 'Contrasena incorrecta.' });

  return sendJson(res, 200, { token: createAdminToken() });
}
