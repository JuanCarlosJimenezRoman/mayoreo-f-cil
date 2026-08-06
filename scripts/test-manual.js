/**
 * scripts/test-manual.js
 * -------------------------------------------------------------
 * Uso: cuando generás el código de prueba en el panel de socios y
 * corrés el curl que te dan, te devuelve un JSON con access_token y
 * user_id (store_id). Pasalos como variables de entorno y corré:
 *
 *   ACCESS_TOKEN=xxxx STORE_ID=1234 node scripts/test-manual.js
 *
 * (Podés correrlo así directo en la pestaña "Shell" de tu Web Service
 * en Render, sin necesidad de editar código ni redeployar).
 *
 * Esto va a: inicializar la tabla en Postgres, registrar la promoción
 * de mayoreo para esa tienda, y guardar todo en la base — así podés
 * probar el webhook de /webhooks/discounts sin haber completado
 * todavía el flujo OAuth real por el navegador.
 * -------------------------------------------------------------
 */

require("dotenv").config();
const { initDb, saveStore, pool } = require("../src/db");
const { registerPromotion } = require("../src/promotions");

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const STORE_ID = process.env.STORE_ID;

async function main() {
  if (!ACCESS_TOKEN || !STORE_ID) {
    console.error(
      "⚠️  Pasá ACCESS_TOKEN y STORE_ID como variables de entorno. Ejemplo:\n" +
        "   ACCESS_TOKEN=abc123 STORE_ID=456789 node scripts/test-manual.js"
    );
    process.exitCode = 1;
    return;
  }

  await initDb();
  await saveStore(STORE_ID, { access_token: ACCESS_TOKEN });

  console.log(`Registrando promoción para la tienda ${STORE_ID}...`);
  const promotionId = await registerPromotion(STORE_ID, ACCESS_TOKEN);

  if (!promotionId) {
    console.error(
      "❌ registerPromotion no devolvió un id válido (revisá el warning de arriba)."
    );
    process.exitCode = 1;
    return;
  }

  await saveStore(STORE_ID, { promotion_id: promotionId });
  console.log("✅ Listo. promotion_id:", promotionId);
}

main()
  .catch((err) => {
    console.error("❌ Error:", err.response?.data || err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
