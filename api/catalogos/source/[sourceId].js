import {
  getCollection,
  handleOptions,
  normalizeProduct,
  parseBody,
  sendJson,
  serializeProduct
} from '../../_mongo.js';
import { requireAdmin } from '../../_auth.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  try {
    if (req.method !== 'PUT') return sendJson(res, 405, { error: 'Metodo no permitido.' });
    if (!requireAdmin(req, res)) return;

    const sourceId = Number(req.query.sourceId);
    if (!Number.isInteger(sourceId) || sourceId < 0) {
      return sendJson(res, 400, { error: 'sourceId invalido.' });
    }

    const collection = await getCollection();
    const product = normalizeProduct({ ...parseBody(req), sourceId, isCustom: false });
    const result = await collection.findOneAndUpdate(
      { sourceId },
      { $set: product, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    return sendJson(res, 200, serializeProduct(result));
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}
