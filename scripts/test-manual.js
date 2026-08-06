/**
 * scripts/test-manual.js
 * -------------------------------------------------------------
 * Uso: cuando generás el código de prueba en el panel de socios y
 * corrés el curl que te dan, te devuelve un JSON con access_token y
 * user_id (store_id). Pegalos acá abajo y corré:
 *
 *   node scripts/test-manual.js
 *
 * Esto va a: inicializar la tabla en Postgres, registrar la promoción
 * de mayoreo para esa tienda, y guardar todo en la base — así podés
 * probar el webhook de /webhooks/discounts sin haber completado
 * todavía el flujo OAuth real por el navegador.
 * -------------------------------------------------------------
 */

require("dotenv").config();
const { initDb, saveStore } = require("../src/db");
const { registerPromotion } = require("../src/promotions");

// 👇 PEGÁ ACÁ LOS DATOS QUE TE DEVOLVIÓ EL CURL DE PRUEBA
const ACCESS_TOKEN = "PEGA_TU_ACCESS_TOKEN_ACA";
const STORE_ID = "PEGA_TU_USER_ID_ACA";

async function main() {
  if (ACCESS_TOKEN.startsWith("PEGA_") || STORE_ID.startsWith("PEGA_")) {
    console.error(
      "⚠️  Editá scripts/test-manual.js y completá ACCESS_TOKEN y STORE_ID antes de correrlo."
    );
    process.exit(1);
  }

  await initDb();
  await saveStore(STORE_ID, { access_token: ACCESS_TOKEN });

  console.log(`Registrando promoción para la tienda ${STORE_ID}...`);
  const promotionId = await registerPromotion(STORE_ID, ACCESS_TOKEN);
  await saveStore(STORE_ID, { promotion_id: promotionId });

  console.log("✅ Listo. promotion_id:", promotionId);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err.response?.data || err.message);
  process.exit(1);
});
