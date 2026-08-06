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

    -- Copia local de las categorías/subcategorías de Tiendanube.
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      parent_id TEXT
    );

    -- Copia local de a qué categoría(s) pertenece cada producto.
    CREATE TABLE IF NOT EXISTS product_categories (
      product_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (product_id, category_id)
    );

    -- Agrupa una o más subcategorías bajo una misma "bolsa" de mayoreo.
    -- Ej: infantil y adulto de pulseras -> mismo group_key "pulseras".
    -- Ej: unicornio y elite de calcetas -> group_keys separados.
    CREATE TABLE IF NOT EXISTS category_groups (
      category_id TEXT PRIMARY KEY,
      group_key TEXT NOT NULL
    );

    -- Tabla de precios por cantidad, por group_key.
    CREATE TABLE IF NOT EXISTS tier_price_rules (
      id SERIAL PRIMARY KEY,
      group_key TEXT NOT NULL,
      min_qty INTEGER NOT NULL,
      unit_price NUMERIC NOT NULL,
      UNIQUE (group_key, min_qty)
    );
  `);
  console.log("✅ Tablas listas.");
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

async function getFirstStore() {
  const { rows } = await pool.query(
    `SELECT store_id, access_token, scope, promotion_id
     FROM stores ORDER BY updated_at DESC LIMIT 1;`
  );
  return rows[0] || null;
}

// --- Categorías -------------------------------------------------

async function upsertCategory(id, name, parentId) {
  await pool.query(
    `INSERT INTO categories (id, name, parent_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;`,
    [String(id), name, parentId ? String(parentId) : null]
  );
}

async function listCategories() {
  const { rows } = await pool.query(
    `SELECT id, name, parent_id FROM categories ORDER BY parent_id NULLS FIRST, name;`
  );
  return rows;
}

// --- Producto -> Categoría ---------------------------------------

async function setProductCategories(productId, categoryIds) {
  await pool.query(`DELETE FROM product_categories WHERE product_id = $1;`, [
    String(productId),
  ]);
  for (const categoryId of categoryIds) {
    await pool.query(
      `INSERT INTO product_categories (product_id, category_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [String(productId), String(categoryId)]
    );
  }
}

async function deleteProduct(productId) {
  await pool.query(`DELETE FROM product_categories WHERE product_id = $1;`, [
    String(productId),
  ]);
}

/**
 * Dado un array de product_id, devuelve un mapa product_id -> [category_id, ...]
 */
async function getCategoriesForProducts(productIds) {
  if (productIds.length === 0) return {};
  const { rows } = await pool.query(
    `SELECT product_id, category_id FROM product_categories
     WHERE product_id = ANY($1::text[]);`,
    [productIds.map(String)]
  );
  const map = {};
  for (const row of rows) {
    if (!map[row.product_id]) map[row.product_id] = [];
    map[row.product_id].push(row.category_id);
  }
  return map;
}

// --- Agrupación de categorías (group_key) -------------------------

async function setCategoryGroup(categoryId, groupKey) {
  await pool.query(
    `INSERT INTO category_groups (category_id, group_key)
     VALUES ($1, $2)
     ON CONFLICT (category_id) DO UPDATE SET group_key = EXCLUDED.group_key;`,
    [String(categoryId), groupKey]
  );
}

async function getAllCategoryGroups() {
  const { rows } = await pool.query(
    `SELECT category_id, group_key FROM category_groups;`
  );
  const map = {};
  for (const row of rows) map[row.category_id] = row.group_key;
  return map;
}

// --- Reglas de precio por cantidad (tiers) -------------------------

async function setTierRule(groupKey, minQty, unitPrice) {
  await pool.query(
    `INSERT INTO tier_price_rules (group_key, min_qty, unit_price)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_key, min_qty) DO UPDATE SET unit_price = EXCLUDED.unit_price;`,
    [groupKey, minQty, unitPrice]
  );
}

async function clearTierRules(groupKey) {
  await pool.query(`DELETE FROM tier_price_rules WHERE group_key = $1;`, [
    groupKey,
  ]);
}

/**
 * Devuelve un mapa group_key -> [{min_qty, unit_price}, ...] ordenado
 * de mayor a menor cantidad, listo para recorrer y encontrar el tier
 * que corresponda.
 */
async function getAllTierRules() {
  const { rows } = await pool.query(
    `SELECT group_key, min_qty, unit_price FROM tier_price_rules
     ORDER BY group_key, min_qty DESC;`
  );
  const map = {};
  for (const row of rows) {
    if (!map[row.group_key]) map[row.group_key] = [];
    map[row.group_key].push({
      min_qty: row.min_qty,
      unit_price: parseFloat(row.unit_price),
    });
  }
  return map;
}

async function deleteCategoryGroup(categoryId) {
  await pool.query(`DELETE FROM category_groups WHERE category_id = $1;`, [
    String(categoryId),
  ]);
}

async function deleteTierRuleGroup(groupKey) {
  await pool.query(`DELETE FROM tier_price_rules WHERE group_key = $1;`, [
    groupKey,
  ]);
  await pool.query(`DELETE FROM category_groups WHERE group_key = $1;`, [
    groupKey,
  ]);
}

module.exports = {
  initDb,
  saveStore,
  getStore,
  getFirstStore,
  pool,
  upsertCategory,
  listCategories,
  setProductCategories,
  deleteProduct,
  getCategoriesForProducts,
  setCategoryGroup,
  deleteCategoryGroup,
  getAllCategoryGroups,
  setTierRule,
  clearTierRules,
  deleteTierRuleGroup,
  getAllTierRules,
};
