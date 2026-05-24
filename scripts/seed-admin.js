import 'dotenv/config';
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxury_fernandez';
const dbName = process.env.MONGODB_DB || 'luxury_fernandez';
const usersCollectionName = process.env.MONGODB_USERS_COLLECTION || 'users';
const username = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'luxury2025';
const iterations = 210000;
const keyLength = 32;
const digest = 'sha256';

function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(value, salt, iterations, keyLength, digest).toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
const now = new Date();

try {
  await client.connect();
  const users = client.db(dbName).collection(usersCollectionName);
  await users.createIndex({ username: 1 }, { unique: true });

  await users.updateOne(
    { username },
    {
      $set: {
        username,
        passwordHash: hashPassword(password),
        role: 'admin',
        active: true,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  console.log(`Usuario admin listo: ${username}`);
  console.log(`Base: ${dbName}`);
  console.log(`Coleccion: ${usersCollectionName}`);
  console.log('La contrasena quedo guardada como hash PBKDF2.');
} finally {
  await client.close();
}
