/**
 * db.js (versión PostgreSQL)
 * -------------------------------------------------------------
 * Reemplaza el almacenamiento en db.json por una tabla en Postgres.
 * Usa la variable de entorno DATABASE_URL (Render te la da al crear
 * la base — ver README para el paso a paso).
 *
 * Guardamos, por store_id:
 *  - access_token: token que te da Tiendanube tras el OAuth
 *  - scope: permisos otorgados
 *  - promotion_id: el ID que devuelve Tiendanube al registrar
 *                   la promoción (POST /promotions)
 * -------------------------------------------------------------
 */

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render Postgres requiere SSL con certificado autofirmado interno.
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      store_id TEXT PRIMARY KEY,
      access_token TEXT,
      scope TEXT,
      promotion_id TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log("✅ Tabla 'stores' lista.");
}

async function saveStore(storeId, data) {
  const existing = await getStore(storeId);

  const merged = {
    access_token: data.access_token ?? existing?.access_token ?? null,
    scope: data.scope ?? existing?.scope ?? null,
    promotion_id: data.promotion_id ?? existing?.promotion_id ?? null,
  };

  await pool.query(
    `INSERT INTO stores (store_id, access_token, scope, promotion_id, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (store_id)
     DO UPDATE SET
       access_token = EXCLUDED.access_token,
       scope = EXCLUDED.scope,
       promotion_id = EXCLUDED.promotion_id,
       updated_at = now();`,
    [storeId, merged.access_token, merged.scope, merged.promotion_id]
  );

  return merged;
}

async function getStore(storeId) {
  const { rows } = await pool.query(
    `SELECT store_id, access_token, scope, promotion_id
     FROM stores WHERE store_id = $1;`,
    [storeId]
  );
  return rows[0] || null;
}

module.exports = { initDb, saveStore, getStore };
