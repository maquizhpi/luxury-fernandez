import { MongoClient, ObjectId } from 'mongodb';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxury_fernandez';
const dbName = process.env.MONGODB_DB || 'luxury_fernandez';
const collectionName = process.env.MONGODB_COLLECTION || 'catalogos';

let clientPromise;

export function isObjectId(value) {
  return ObjectId.isValid(value);
}

export function toObjectId(value) {
  return new ObjectId(value);
}

export async function getCollection() {
  if (!clientPromise) {
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  const collection = client.db(dbName).collection(collectionName);
  await collection.createIndex({ sourceId: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ createdAt: 1 });
  return collection;
}

export function normalizeProduct(body = {}) {
  const now = new Date();
  const product = {
    img: String(body.img || '').trim(),
    brand: String(body.brand || '').trim(),
    name: String(body.name || '').trim(),
    cat: String(body.cat || '').trim(),
    price: String(body.price || 'Consultar precio').trim() || 'Consultar precio',
    desc: String(body.desc || '').trim(),
    tag: String(body.tag || '').trim(),
    hidden: Boolean(body.hidden),
    deleted: Boolean(body.deleted),
    updatedAt: now
  };

  if (Number.isInteger(body.sourceId)) product.sourceId = body.sourceId;
  if (body.isCustom !== undefined) product.isCustom = Boolean(body.isCustom);
  return product;
}

export function serializeProduct(product) {
  return {
    ...product,
    _id: product._id.toString()
  };
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body;
}

export function sendJson(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(status).json(body);
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false;
  sendJson(res, 200, {});
  return true;
}
