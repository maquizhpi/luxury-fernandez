import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxury_fernandez';
const dbName = process.env.MONGODB_DB || 'luxury_fernandez';
const collectionName = process.env.MONGODB_COLLECTION || 'catalogos';
const usersCollectionName = process.env.MONGODB_USERS_COLLECTION || 'users';
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'luxury2025';
const tokenSecret = process.env.ADMIN_TOKEN_SECRET || adminPassword;
const passwordIterations = 210000;
const passwordKeyLength = 32;
const passwordDigest = 'sha256';

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
let collectionPromise;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));

async function getCollection() {
  if (!collectionPromise) {
    collectionPromise = client.connect().then(async () => {
      const collection = client.db(dbName).collection(collectionName);
      await collection.createIndex({ sourceId: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ createdAt: 1 });
      return collection;
    });
  }
  return collectionPromise;
}

async function getUsersCollection() {
  const connectedClient = await client.connect();
  const collection = connectedClient.db(dbName).collection(usersCollectionName);
  await collection.createIndex({ username: 1 }, { unique: true });
  return collection;
}

function sign(value) {
  return crypto.createHmac('sha256', tokenSecret).update(value).digest('hex');
}

function verifyPassword(password, storedHash = '') {
  const [scheme, rawIterations, salt, hash] = storedHash.split('$');
  if (scheme !== 'pbkdf2' || !rawIterations || !salt || !hash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, Number(rawIterations), passwordKeyLength, passwordDigest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
}

function createAdminToken(username = adminUser) {
  const payload = JSON.stringify({ role: 'admin', username, exp: Date.now() + 1000 * 60 * 60 * 12 });
  const encoded = Buffer.from(payload).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

async function validateAdminCredentials(username, password) {
  const normalized = String(username || '').trim().toLowerCase();

  try {
    const users = await getUsersCollection();
    const user = await users.findOne({ username: normalized, active: { $ne: false } });
    if (user?.passwordHash && verifyPassword(password, user.passwordHash)) return user;
  } catch (error) {
    console.warn(error);
  }

  if (normalized === adminUser && password === adminPassword) return { username: adminUser, role: 'admin' };
  return null;
}

function verifyAdminToken(token = '') {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature || sign(encoded) !== signature) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (verifyAdminToken(token)) return next();
  return res.status(401).json({ error: 'Sesion de administrador requerida.' });
}

function normalizeProduct(body) {
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

function serializeProduct(product) {
  return {
    ...product,
    _id: product._id.toString()
  };
}

app.get('/api/health', async (_req, res) => {
  try {
    await getCollection();
    res.json({ ok: true, db: dbName, collection: collectionName });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const user = await validateAdminCredentials(req.body?.username || 'admin', req.body?.password);
  if (!user) return res.status(401).json({ error: 'Usuario o contrasena incorrectos.' });

  return res.json({ token: createAdminToken(user.username), username: user.username });
});

app.get('/api/catalogos', async (_req, res) => {
  try {
    const collection = await getCollection();
    const products = await collection.find({}).sort({ sourceId: 1, createdAt: 1 }).toArray();
    res.json(products.map(serializeProduct));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/catalogos', requireAdmin, async (req, res) => {
  try {
    const collection = await getCollection();
    const product = {
      ...normalizeProduct(req.body),
      isCustom: true,
      createdAt: new Date()
    };

    if (!product.name || !product.brand || !product.img) {
      return res.status(400).json({ error: 'Nombre, marca e imagen son obligatorios.' });
    }

    const result = await collection.insertOne(product);
    res.status(201).json(serializeProduct({ ...product, _id: result.insertedId }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/catalogos/source/:sourceId', requireAdmin, async (req, res) => {
  try {
    const sourceId = Number(req.params.sourceId);
    if (!Number.isInteger(sourceId) || sourceId < 0) {
      return res.status(400).json({ error: 'sourceId invalido.' });
    }

    const collection = await getCollection();
    const product = normalizeProduct({ ...req.body, sourceId, isCustom: false });
    const result = await collection.findOneAndUpdate(
      { sourceId },
      { $set: product, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    res.json(serializeProduct(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/catalogos/:id', requireAdmin, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID invalido.' });
    }

    const collection = await getCollection();
    const product = normalizeProduct(req.body);
    delete product.sourceId;
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: product },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(serializeProduct(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/catalogos/:id', requireAdmin, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID invalido.' });
    }
    const collection = await getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Luxury Fernandez listo en http://localhost:${port}`);
  console.log(`MongoDB: ${dbName}.${collectionName}`);
});
