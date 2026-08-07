/**
 * scripts/register-product-webhooks.js
 * -------------------------------------------------------------
 * Le dice a Tiendanube que te avise cada vez que se crea, edita o
 * borra un producto, para que tu app sincronice sola sin scripts
 * manuales.
 *
 * Uso normal (usa la tienda ya instalada, guardada en tu base):
 *   node scripts/register-product-webhooks.js
 *
 * Uso forzando otra tienda/token puntual:
 *   ACCESS_TOKEN=xxxx STORE_ID=8057813 node scripts/register-product-webhooks.js
 * -------------------------------------------------------------
 */

require("dotenv").config();
const axios = require("axios");
const { initDb, getFirstStore, pool } = require("../src/db");

const API_VERSION = "2025-03";
const { APP_URL, APP_USER_AGENT } = process.env;

const EVENTS = ["product/created", "product/updated", "product/deleted"];

async function main() {
  await initDb();

  let ACCESS_TOKEN = process.env.ACCESS_TOKEN;
  let STORE_ID = process.env.STORE_ID;

  if (!ACCESS_TOKEN || !STORE_ID) {
    const store = await getFirstStore();
    if (!store) {
      console.error(
        "⚠️  No hay ninguna tienda instalada todavía, y no pasaste ACCESS_TOKEN/STORE_ID a mano."
      );
      process.exitCode = 1;
      return;
    }
    ACCESS_TOKEN = ACCESS_TOKEN || store.access_token;
    STORE_ID = STORE_ID || store.store_id;
    console.log(`(usando la tienda guardada: store_id=${STORE_ID})`);
  }

  for (const event of EVENTS) {
    try {
      const { data } = await axios.post(
        `https://api.tiendanube.com/${API_VERSION}/${STORE_ID}/webhooks`,
        {
          event,
          url: `${APP_URL}/webhooks/products`,
        },
        {
          headers: {
            Authentication: `bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            "User-Agent":
              APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
          },
        }
      );
      console.log(`✅ Registrado: ${event} → id ${data.id ?? data.data?.id}`);
    } catch (err) {
      console.error(
        `❌ Error registrando ${event}:`,
        err.response?.data || err.message
      );
    }
  }
}

main().finally(async () => {
  await pool.end();
});
