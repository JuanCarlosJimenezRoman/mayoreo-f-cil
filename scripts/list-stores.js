/**
 * scripts/list-stores.js
 * -------------------------------------------------------------
 * Muestra todas las tiendas que tu app tiene guardadas en Postgres,
 * para diagnosticar rápido cuál está activa y cuándo se actualizó
 * por última vez.
 *
 * Uso:
 *   node scripts/list-stores.js
 * -------------------------------------------------------------
 */

require("dotenv").config();
const { initDb, pool } = require("../src/db");

async function main() {
  await initDb();

  const { rows } = await pool.query(
    `SELECT store_id, promotion_id, admin_token,
            LEFT(access_token, 8) || '...' AS token_preview,
            updated_at
     FROM stores
     ORDER BY updated_at DESC;`
  );

  if (rows.length === 0) {
    console.log("No hay ninguna tienda guardada todavía.");
    return;
  }

  console.log(`\nTiendas guardadas (${rows.length}):\n`);
  for (const row of rows) {
    console.log(
      `store_id=${row.store_id}  promotion_id=${row.promotion_id}  token=${row.token_preview}  actualizado=${row.updated_at.toISOString()}`
    );
    if (row.admin_token) {
      console.log(
        `  → link al dashboard: ${process.env.APP_URL || "https://tu-app.onrender.com"}/admin?token=${row.admin_token}`
      );
    } else {
      console.log("  → todavía no tiene admin_token generado.");
    }
  }
}

main()
  .catch((err) => console.error("❌ Error:", err.message))
  .finally(async () => {
    await pool.end();
  });
