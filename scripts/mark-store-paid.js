/**
 * scripts/mark-store-paid.js
 * -------------------------------------------------------------
 * Marca una tienda como con el plan pago activo, sin fecha de
 * vencimiento. Usalo a mano por ahora (hasta que conectes un cobro
 * real, sea el sistema nativo de Tiendanube o "compras internas"
 * con tu propia pasarela).
 *
 * Uso:
 *   STORE_ID=8057813 node scripts/mark-store-paid.js
 * -------------------------------------------------------------
 */

require("dotenv").config();
const { initDb, activatePaidPlan, pool } = require("../src/db");

async function main() {
  const STORE_ID = process.env.STORE_ID;
  if (!STORE_ID) {
    console.error("⚠️  Pasá STORE_ID como variable de entorno.");
    process.exitCode = 1;
    return;
  }

  await initDb();
  await activatePaidPlan(STORE_ID);
  console.log(`✅ Tienda ${STORE_ID} marcada como plan pago activo.`);
}

main()
  .catch((err) => {
    console.error("❌ Error:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
