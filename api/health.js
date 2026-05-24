import { getCollection, sendJson } from './_mongo.js';

export default async function handler(req, res) {
  try {
    await getCollection();
    sendJson(res, 200, {
      ok: true,
      db: process.env.MONGODB_DB || 'luxury_fernandez',
      collection: process.env.MONGODB_COLLECTION || 'catalogos'
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
}
