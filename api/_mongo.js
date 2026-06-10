import { MongoClient, ObjectId } from 'mongodb';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxury_fernandez';
const dbName = process.env.MONGODB_DB || 'luxury_fernandez';
const collectionName = process.env.MONGODB_COLLECTION || 'catalogos';
const usersCollectionName = process.env.MONGODB_USERS_COLLECTION || 'users';

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

export async function getUsersCollection() {
  if (!clientPromise) {
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  const collection = client.db(dbName).collection(usersCollectionName);
  await collection.createIndex({ username: 1 }, { unique: true });
  return collection;
}

function sanitizeText(value, maxLen = 500) {
  return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

function sanitizeImageUrl(value) {
  const str = String(value || '').trim().slice(0, 1000);
  const lower = str.toLowerCase().replace(/\s/g, '');
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return '';
  }
  return str;
}

export function normalizeProduct(body = {}) {
  const now = new Date();
  const rawPrice = sanitizeText(body.price, 50);
  const product = {
    img: sanitizeImageUrl(body.img),
    brand: sanitizeText(body.brand, 100),
    name: sanitizeText(body.name, 200),
    cat: sanitizeText(body.cat, 100),
    price: rawPrice || 'Consultar precio',
    desc: sanitizeText(body.desc, 2000),
    tag: sanitizeText(body.tag, 100),
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  return res.status(status).json(body);
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false;
  sendJson(res, 200, {});
  return true;
}
