import 'dotenv/config';
import fs from 'node:fs';
import { MongoClient } from 'mongodb';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxury_fernandez';
const dbName = process.env.MONGODB_DB || 'luxury_fernandez';
const collectionName = process.env.MONGODB_COLLECTION || 'catalogos';

function extractProductsSource(html) {
  const start = html.indexOf('const products = [');
  if (start === -1) throw new Error('No se encontro const products en index.html');

  const arrayStart = html.indexOf('[', start);
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = arrayStart; i < html.length; i++) {
    const char = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      quote = char;
      continue;
    }

    if (char === '[') depth++;
    if (char === ']') depth--;
    if (depth === 0) return html.slice(arrayStart, i + 1);
  }

  throw new Error('No se pudo cerrar el arreglo products.');
}

function extractTags(html) {
  const tags = new Map();
  const cardRegex = /<div class="product-card"[^>]*data-idx="(\d+)"[\s\S]*?<div class="card-tag tag-([^"]+)">([^<]+)<\/div>/g;
  let match;

  while ((match = cardRegex.exec(html))) {
    tags.set(Number(match[1]), {
      tag: match[2],
      tagLabel: match[3].trim()
    });
  }

  return tags;
}

const html = fs.readFileSync('index.html', 'utf8');
const products = Function(`"use strict"; return (${extractProductsSource(html)});`)();
const tags = extractTags(html);
const now = new Date();

const docs = products.map((product, sourceId) => ({
  ...product,
  ...(tags.get(sourceId) || {}),
  sourceId,
  isCustom: false,
  hidden: Boolean(product.hidden),
  deleted: Boolean(product.deleted),
  updatedAt: now
}));

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });

try {
  await client.connect();
  const collection = client.db(dbName).collection(collectionName);
  await collection.createIndex({ sourceId: 1 }, { unique: true, sparse: true });

  const operations = docs.map(doc => ({
    updateOne: {
      filter: { sourceId: doc.sourceId },
      update: {
        $set: doc,
        $setOnInsert: { createdAt: now }
      },
      upsert: true
    }
  }));

  const result = await collection.bulkWrite(operations);
  const total = await collection.countDocuments({});

  console.log(`Base: ${dbName}`);
  console.log(`Coleccion: ${collectionName}`);
  console.log(`Productos procesados: ${docs.length}`);
  console.log(`Insertados: ${result.upsertedCount}`);
  console.log(`Actualizados: ${result.modifiedCount}`);
  console.log(`Total en coleccion: ${total}`);
} finally {
  await client.close();
}
