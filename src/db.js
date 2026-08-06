/**
 * db.js
 * -------------------------------------------------------------
 * Almacenamiento MINIMO para poder arrancar rápido: guarda todo en
 * un archivo db.json local. Esto sirve para desarrollo y para probar,
 * pero en producción real (server pago, más de una tienda instalada,
 * reinicios del server, etc.) DEBERÍAS reemplazar esto por una base
 * de datos de verdad (Postgres, SQLite con volumen persistente,
 * MongoDB, etc.), porque un archivo JSON se puede corromper o
 * perderse si el hosting reinicia el filesystem.
 *
 * Guardamos, por store_id:
 *  - access_token: token que te da Tiendanube tras el OAuth
 *  - promotion_id: el ID que te devuelve Tiendanube al registrar
 *                   la promoción (POST /promotions)
 * -------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "db.json");

function readDb() {
  if (!fs.existsSync(DB_PATH)) return { stores: {} };
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function saveStore(storeId, data) {
  const db = readDb();
  db.stores[storeId] = { ...(db.stores[storeId] || {}), ...data };
  writeDb(db);
  return db.stores[storeId];
}

function getStore(storeId) {
  const db = readDb();
  return db.stores[storeId] || null;
}

module.exports = { saveStore, getStore };
