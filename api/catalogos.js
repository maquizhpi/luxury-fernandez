import {
  getCollection,
  handleOptions,
  normalizeProduct,
  parseBody,
  sendJson,
  serializeProduct
} from './_mongo.js';
import { requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  try {
    const collection = await getCollection();

    if (req.method === 'GET') {
      const products = await collection.find({}).sort({ sourceId: 1, createdAt: 1 }).toArray();
      return sendJson(res, 200, products.map(serializeProduct));
    }

    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = parseBody(req);
      const product = {
        ...normalizeProduct(body),
        isCustom: true,
        createdAt: new Date()
      };

      if (!product.name || !product.brand || !product.img) {
        return sendJson(res, 400, { error: 'Nombre, marca e imagen son obligatorios.' });
      }

      const result = await collection.insertOne(product);
      return sendJson(res, 201, serializeProduct({ ...product, _id: result.insertedId }));
    }

    return sendJson(res, 405, { error: 'Metodo no permitido.' });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}
