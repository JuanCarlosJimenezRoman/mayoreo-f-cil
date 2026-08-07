/**
 * scripts/generate-admin-link.js
 * -------------------------------------------------------------
 * Genera (o regenera) el magic link del dashboard para una tienda
 * que ya estaba instalada ANTES de que existiera el sistema de
 * magic links (o si perdiste/necesitás invalidar un link viejo).
 *
 * Uso:
 *   STORE_ID=8057813 node scripts/generate-admin-link.js
 * (si no pasás STORE_ID, usa la última tienda instalada)
 * -------------------------------------------------------------
 */

require("dotenv").config();
const { initDb, getFirstStore, ensureAdminToken, pool } = require("../src/db");

async function main() {
  await initDb();

  let STORE_ID = process.env.STORE_ID;
  if (!STORE_ID) {
    const store = await getFirstStore();
    if (!store) {
      console.error("⚠️  No hay ninguna tienda instalada y no pasaste STORE_ID.");
      process.exitCode = 1;
      return;
    }
    STORE_ID = store.store_id;
    console.log(`(usando la tienda guardada: store_id=${STORE_ID})`);
  }

  const token = await ensureAdminToken(STORE_ID);
  const appUrl = process.env.APP_URL || "https://tu-app.onrender.com";

  console.log(`\n✅ Link generado para la tienda ${STORE_ID}:\n`);
  console.log(`${appUrl}/admin?token=${token}\n`);
  console.log("Guardalo — es tu acceso directo al dashboard.");
}

main()
  .catch((err) => {
    console.error("❌ Error:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
