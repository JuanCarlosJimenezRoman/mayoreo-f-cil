/**
 * scripts/register-required-webhooks.js
 * -------------------------------------------------------------
 * Registra los webhooks OBLIGATORIOS para homologación:
 *  - app/uninstalled
 *  - store/redact
 *  - customers/redact
 *  - customers/data_request
 *
 * Uso:
 *   node scripts/register-required-webhooks.js
 * (usa la tienda guardada más reciente; o pasá STORE_ID/ACCESS_TOKEN
 * para forzar otra)
 * -------------------------------------------------------------
 */

require("dotenv").config();
const axios = require("axios");
const { initDb, getFirstStore, pool } = require("../src/db");

const API_VERSION = "2025-03";
const { APP_URL, APP_USER_AGENT } = process.env;

const EVENTS = [
  "app/uninstalled",
  "store/redact",
  "customers/redact",
  "customers/data_request",
];

async function main() {
  await initDb();

  let ACCESS_TOKEN = process.env.ACCESS_TOKEN;
  let STORE_ID = process.env.STORE_ID;

  if (!ACCESS_TOKEN || !STORE_ID) {
    const store = await getFirstStore();
    if (!store) {
      console.error("⚠️  No hay ninguna tienda instalada y no pasaste ACCESS_TOKEN/STORE_ID.");
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
        { event, url: `${APP_URL}/webhooks/lifecycle` },
        {
          headers: {
            Authentication: `bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            "User-Agent": APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
          },
        }
      );
      console.log(`✅ Registrado: ${event} → id ${data.id ?? data.data?.id}`);
    } catch (err) {
      console.error(`❌ Error registrando ${event}:`, err.response?.data || err.message);
    }
  }
}

main().finally(async () => {
  await pool.end();
});
