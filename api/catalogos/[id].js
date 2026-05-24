import {
  getCollection,
  handleOptions,
  isObjectId,
  normalizeProduct,
  parseBody,
  sendJson,
  serializeProduct,
  toObjectId
} from '../_mongo.js';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  try {
    if (req.method !== 'PUT') return sendJson(res, 405, { error: 'Metodo no permitido.' });
    if (!requireAdmin(req, res)) return;
    const { id } = req.query;
    if (!isObjectId(id)) return sendJson(res, 400, { error: 'ID invalido.' });

    const collection = await getCollection();
    const product = normalizeProduct(parseBody(req));
    delete product.sourceId;

    const result = await collection.findOneAndUpdate(
      { _id: toObjectId(id) },
      { $set: product },
      { returnDocument: 'after' }
    );

    if (!result) return sendJson(res, 404, { error: 'Producto no encontrado.' });
    return sendJson(res, 200, serializeProduct(result));
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}
