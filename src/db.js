/**
 * db.js (multi-tienda)
 * -------------------------------------------------------------
 * Cada tabla de configuración (categorías, grupos, tiers, errores)
 * está aislada por store_id, para que múltiples tiendas puedan usar
 * esta misma app sin pisarse los datos entre sí.
 *
 * `stores` guarda, por tienda:
 *  - access_token: token de la API de Tiendanube
 *  - promotion_id: la promoción de mayoreo registrada
 *  - admin_token: token secreto único para el magic link del dashboard
 * -------------------------------------------------------------
 */

const { Pool } = require("pg");
const crypto = require("crypto");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Se asegura de que `table` tenga una restricción PRIMARY KEY o UNIQUE
 * exactamente sobre `columns` (en ese conjunto, sin importar el orden).
 * Si ya existe una que matchea, no hace nada. Si existe otra distinta
 * (típicamente de antes del modelo multi-tienda, más angosta), la
 * borra y crea la nueva. Necesario para que ON CONFLICT funcione.
 */
async function ensureCompositeConstraint(table, columns, isPrimaryKey) {
  const wantedType = isPrimaryKey ? "p" : "u";
  const wantedSet = [...columns].sort().join(",");

  const { rows: constraints } = await pool.query(
    `SELECT conname, contype, conkey FROM pg_constraint
     WHERE conrelid = $1::regclass AND contype IN ('p', 'u');`,
    [table]
  );

  for (const c of constraints) {
    const { rows: colRows } = await pool.query(
      `SELECT attname FROM pg_attribute
       WHERE attrelid = $1::regclass AND attnum = ANY($2::int[]);`,
      [table, c.conkey]
    );
    const existingSet = colRows.map((r) => r.attname).sort().join(",");

    if (c.contype === wantedType && existingSet === wantedSet) {
      return; // ya está bien, nada que hacer
    }

    // Es una restricción vieja/distinta: la sacamos para poder poner
    // la correcta. CASCADE por si algo (poco probable acá) depende de ella.
    await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT "${c.conname}" CASCADE;`);
  }

  const constraintSql = isPrimaryKey ? "PRIMARY KEY" : "UNIQUE";
  await pool.query(
    `ALTER TABLE ${table} ADD ${constraintSql} (${columns.join(", ")});`
  );
  console.log(`✅ Restricción actualizada en ${table}: ${constraintSql} (${columns.join(", ")})`);
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      store_id TEXT PRIMARY KEY,
      access_token TEXT,
      scope TEXT,
      promotion_id TEXT,
      admin_token TEXT UNIQUE,
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS categories (
      store_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT,
      parent_id TEXT,
      PRIMARY KEY (store_id, id)
    );

    CREATE TABLE IF NOT EXISTS product_categories (
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (store_id, product_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS category_groups (
      store_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      group_key TEXT NOT NULL,
      PRIMARY KEY (store_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS tier_price_rules (
      id SERIAL PRIMARY KEY,
      store_id TEXT NOT NULL,
      group_key TEXT NOT NULL,
      min_qty INTEGER NOT NULL,
      unit_price NUMERIC NOT NULL,
      UNIQUE (store_id, group_key, min_qty)
    );

    CREATE TABLE IF NOT EXISTS error_log (
      id SERIAL PRIMARY KEY,
      store_id TEXT,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Migración suave: si alguna de estas tablas ya existía de una
    -- versión anterior sin store_id, esto la agrega sin romper nada.
    ALTER TABLE stores ADD COLUMN IF NOT EXISTS admin_token TEXT;
    ALTER TABLE stores ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'trialing';
    ALTER TABLE stores ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
    ALTER TABLE error_log ADD COLUMN IF NOT EXISTS store_id TEXT;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS store_id TEXT;
    ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS store_id TEXT;
    ALTER TABLE category_groups ADD COLUMN IF NOT EXISTS store_id TEXT;
    ALTER TABLE tier_price_rules ADD COLUMN IF NOT EXISTS store_id TEXT;
  `);

  // Si estas tablas ya tenían filas de ANTES del modelo multi-tienda,
  // quedaron con store_id vacío. Se las asignamos a la tienda más
  // reciente (lo normal si hasta ahora solo tenías una tienda usando
  // la app), para no perder esa configuración.
  const { rows: storeRows } = await pool.query(
    `SELECT store_id FROM stores ORDER BY updated_at DESC LIMIT 1;`
  );
  if (storeRows.length > 0) {
    const fallbackStoreId = storeRows[0].store_id;
    await pool.query(`UPDATE categories SET store_id = $1 WHERE store_id IS NULL;`, [fallbackStoreId]);
    await pool.query(`UPDATE product_categories SET store_id = $1 WHERE store_id IS NULL;`, [fallbackStoreId]);
    await pool.query(`UPDATE category_groups SET store_id = $1 WHERE store_id IS NULL;`, [fallbackStoreId]);
    await pool.query(`UPDATE tier_price_rules SET store_id = $1 WHERE store_id IS NULL;`, [fallbackStoreId]);
  }

  // Tiendas que ya estaban instaladas ANTES de que existiera el
  // sistema de prueba/plan pago no tienen trial_ends_at — las
  // dejamos como plan activo automáticamente, para no bloquearlas
  // de sorpresa por una fecha que nunca se les asignó.
  await pool.query(
    `UPDATE stores SET plan_status = 'active' WHERE trial_ends_at IS NULL AND plan_status != 'active';`
  );

  // Estas 4 tablas existían de ANTES del modelo multi-tienda con
  // restricciones únicas más angostas (sin store_id). Le agregamos
  // store_id a la restricción para que ON CONFLICT funcione bien
  // ahora que puede haber varias tiendas. Es seguro correrlo de
  // nuevo en cada arranque: si ya está bien, no hace nada.
  await ensureCompositeConstraint("categories", ["store_id", "id"], true);
  await ensureCompositeConstraint(
    "product_categories",
    ["store_id", "product_id", "category_id"],
    true
  );
  await ensureCompositeConstraint("category_groups", ["store_id", "category_id"], true);
  await ensureCompositeConstraint(
    "tier_price_rules",
    ["store_id", "group_key", "min_qty"],
    false
  );

  console.log("✅ Tablas listas.");
}

// --- Tiendas ---------------------------------------------------------

async function saveStore(storeId, data) {
  const existing = await getStore(storeId);
  const isNewStore = !existing;

  const merged = {
    access_token: data.access_token ?? existing?.access_token ?? null,
    scope: data.scope ?? existing?.scope ?? null,
    promotion_id: data.promotion_id ?? existing?.promotion_id ?? null,
    admin_token: data.admin_token ?? existing?.admin_token ?? null,
    plan_status: data.plan_status ?? existing?.plan_status ?? "trialing",
    // 15 días de prueba gratis desde la primera instalación. Si la
    // tienda ya existía, no le tocamos la fecha (no le "regalamos"
    // otra prueba gratis por reinstalar).
    trial_ends_at:
      data.trial_ends_at ??
      existing?.trial_ends_at ??
      (isNewStore
        ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
        : null),
  };

  await pool.query(
    `INSERT INTO stores (store_id, access_token, scope, promotion_id, admin_token, plan_status, trial_ends_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (store_id)
     DO UPDATE SET
       access_token = EXCLUDED.access_token,
       scope = EXCLUDED.scope,
       promotion_id = EXCLUDED.promotion_id,
       admin_token = EXCLUDED.admin_token,
       plan_status = EXCLUDED.plan_status,
       trial_ends_at = COALESCE(stores.trial_ends_at, EXCLUDED.trial_ends_at),
       updated_at = now();`,
    [
      storeId,
      merged.access_token,
      merged.scope,
      merged.promotion_id,
      merged.admin_token,
      merged.plan_status,
      merged.trial_ends_at,
    ]
  );

  return merged;
}

async function getStore(storeId) {
  const { rows } = await pool.query(
    `SELECT store_id, access_token, scope, promotion_id, admin_token, plan_status, trial_ends_at
     FROM stores WHERE store_id = $1;`,
    [storeId]
  );
  return rows[0] || null;
}

async function getFirstStore() {
  const { rows } = await pool.query(
    `SELECT store_id, access_token, scope, promotion_id, admin_token, plan_status, trial_ends_at
     FROM stores ORDER BY updated_at DESC LIMIT 1;`
  );
  return rows[0] || null;
}

/**
 * Marca una tienda como con el plan pago activo (sin fecha de
 * vencimiento). Usalo a mano hasta que conectes el cobro real
 * (nativo de Tiendanube o compras internas).
 */
async function activatePaidPlan(storeId) {
  await pool.query(
    `UPDATE stores SET plan_status = 'active', updated_at = now() WHERE store_id = $1;`,
    [storeId]
  );
}

/**
 * true si la tienda puede seguir usando el dashboard: está en plan
 * pago activo, o todavía le quedan días de prueba.
 */
function isStoreActive(store) {
  if (!store) return false;
  if (store.plan_status === "active") return true;
  if (store.plan_status === "trialing" && store.trial_ends_at) {
    return new Date(store.trial_ends_at) > new Date();
  }
  return false;
}

function daysLeftInTrial(store) {
  if (!store?.trial_ends_at) return 0;
  const ms = new Date(store.trial_ends_at) - new Date();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Genera (o regenera) un token secreto único para el magic link del
 * dashboard de una tienda, y lo guarda.
 */
async function ensureAdminToken(storeId) {
  const token = crypto.randomBytes(24).toString("hex");
  await pool.query(`UPDATE stores SET admin_token = $2 WHERE store_id = $1;`, [
    storeId,
    token,
  ]);
  return token;
}

async function getStoreByAdminToken(token) {
  const { rows } = await pool.query(
    `SELECT store_id, access_token, scope, promotion_id, admin_token, plan_status, trial_ends_at
     FROM stores WHERE admin_token = $1;`,
    [token]
  );
  return rows[0] || null;
}

// --- Categorías -------------------------------------------------

async function upsertCategory(storeId, id, name, parentId) {
  await pool.query(
    `INSERT INTO categories (store_id, id, name, parent_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (store_id, id) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;`,
    [storeId, String(id), name, parentId ? String(parentId) : null]
  );
}

async function listCategories(storeId) {
  const { rows } = await pool.query(
    `SELECT id, name, parent_id FROM categories WHERE store_id = $1
     ORDER BY parent_id NULLS FIRST, name;`,
    [storeId]
  );
  return rows;
}

// --- Producto -> Categoría ---------------------------------------

async function setProductCategories(storeId, productId, categoryIds) {
  await pool.query(
    `DELETE FROM product_categories WHERE store_id = $1 AND product_id = $2;`,
    [storeId, String(productId)]
  );
  for (const categoryId of categoryIds) {
    await pool.query(
      `INSERT INTO product_categories (store_id, product_id, category_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING;`,
      [storeId, String(productId), String(categoryId)]
    );
  }
}

async function deleteProduct(storeId, productId) {
  await pool.query(
    `DELETE FROM product_categories WHERE store_id = $1 AND product_id = $2;`,
    [storeId, String(productId)]
  );
}

async function getCategoriesForProducts(storeId, productIds) {
  if (productIds.length === 0) return {};
  const { rows } = await pool.query(
    `SELECT product_id, category_id FROM product_categories
     WHERE store_id = $1 AND product_id = ANY($2::text[]);`,
    [storeId, productIds.map(String)]
  );
  const map = {};
  for (const row of rows) {
    if (!map[row.product_id]) map[row.product_id] = [];
    map[row.product_id].push(row.category_id);
  }
  return map;
}

// --- Agrupación de categorías (group_key) -------------------------

async function setCategoryGroup(storeId, categoryId, groupKey) {
  await pool.query(
    `INSERT INTO category_groups (store_id, category_id, group_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (store_id, category_id) DO UPDATE SET group_key = EXCLUDED.group_key;`,
    [storeId, String(categoryId), groupKey]
  );
}

async function deleteCategoryGroup(storeId, categoryId) {
  await pool.query(
    `DELETE FROM category_groups WHERE store_id = $1 AND category_id = $2;`,
    [storeId, String(categoryId)]
  );
}

async function getAllCategoryGroups(storeId) {
  const { rows } = await pool.query(
    `SELECT category_id, group_key FROM category_groups WHERE store_id = $1;`,
    [storeId]
  );
  const map = {};
  for (const row of rows) map[row.category_id] = row.group_key;
  return map;
}

// --- Reglas de precio por cantidad (tiers) -------------------------

async function setTierRule(storeId, groupKey, minQty, unitPrice) {
  await pool.query(
    `INSERT INTO tier_price_rules (store_id, group_key, min_qty, unit_price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (store_id, group_key, min_qty) DO UPDATE SET unit_price = EXCLUDED.unit_price;`,
    [storeId, groupKey, minQty, unitPrice]
  );
}

async function clearTierRules(storeId, groupKey) {
  await pool.query(
    `DELETE FROM tier_price_rules WHERE store_id = $1 AND group_key = $2;`,
    [storeId, groupKey]
  );
}

async function deleteTierRuleGroup(storeId, groupKey) {
  await pool.query(
    `DELETE FROM tier_price_rules WHERE store_id = $1 AND group_key = $2;`,
    [storeId, groupKey]
  );
  await pool.query(
    `DELETE FROM category_groups WHERE store_id = $1 AND group_key = $2;`,
    [storeId, groupKey]
  );
}

async function getAllTierRules(storeId) {
  const { rows } = await pool.query(
    `SELECT group_key, min_qty, unit_price FROM tier_price_rules
     WHERE store_id = $1 ORDER BY group_key, min_qty DESC;`,
    [storeId]
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

// --- Monitoreo ------------------------------------------------------

async function logError(storeId, source, message) {
  try {
    await pool.query(
      `INSERT INTO error_log (store_id, source, message) VALUES ($1, $2, $3);`,
      [storeId || null, source, String(message).slice(0, 2000)]
    );
  } catch (err) {
    console.error("No se pudo guardar el error en error_log:", err.message);
  }
}

async function getRecentErrors(storeId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT id, source, message, created_at FROM error_log
     WHERE store_id = $1 ORDER BY created_at DESC LIMIT $2;`,
    [storeId, limit]
  );
  return rows;
}

async function clearErrors(storeId) {
  await pool.query(`DELETE FROM error_log WHERE store_id = $1;`, [storeId]);
}

async function getSyncedProductCount(storeId) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT product_id) AS count FROM product_categories WHERE store_id = $1;`,
    [storeId]
  );
  return parseInt(rows[0].count, 10);
}

async function getErrorCountSince(storeId, days) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM error_log
     WHERE store_id = $1 AND created_at > now() - ($2 || ' days')::interval;`,
    [storeId, days]
  );
  return parseInt(rows[0].count, 10);
}

async function getProductCountsByGroup(storeId) {
  const { rows } = await pool.query(
    `SELECT cg.group_key, COUNT(DISTINCT pc.product_id) AS count
     FROM category_groups cg
     JOIN product_categories pc
       ON pc.category_id = cg.category_id AND pc.store_id = cg.store_id
     WHERE cg.store_id = $1
     GROUP BY cg.group_key;`,
    [storeId]
  );
  const map = {};
  for (const row of rows) map[row.group_key] = parseInt(row.count, 10);
  return map;
}

module.exports = {
  initDb,
  saveStore,
  getStore,
  getFirstStore,
  ensureAdminToken,
  getStoreByAdminToken,
  activatePaidPlan,
  isStoreActive,
  daysLeftInTrial,
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
  logError,
  getRecentErrors,
  clearErrors,
  getSyncedProductCount,
  getErrorCountSince,
  getProductCountsByGroup,
};
