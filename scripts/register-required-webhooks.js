/**
 * scripts/register-required-webhooks.js
 * -------------------------------------------------------------
 * Registra el webhook de app/uninstalled (el único de estos 4 que
 * se registra por la API normal de Webhooks).
 *
 * Los otros 3 — store/redact, customers/redact, customers/data_request
 * — NO se registran por acá: Tiendanube los maneja aparte, como un
 * mecanismo separado de cumplimiento LGPD. Se configuran a mano en
 * el panel de socios, en la config de tu app, en los campos:
 *   - "URL webhook store redact"
 *   - "URL webhook customers redact"
 *   - "URL webhook customers data request"
 * En los 3, poné: TU_APP_URL/webhooks/lifecycle (mismo endpoint,
 * el código ya distingue el evento por el campo "event" del body).
 *
 * Uso:
 *   node scripts/register-required-webhooks.js
 * -------------------------------------------------------------
 */

require("dotenv").config();
const axios = require("axios");
const { initDb, getFirstStore, pool } = require("../src/db");

const API_VERSION = "2025-03";
const { APP_URL, APP_USER_AGENT } = process.env;

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

  try {
    const { data } = await axios.post(
      `https://api.tiendanube.com/${API_VERSION}/${STORE_ID}/webhooks`,
      { event: "app/uninstalled", url: `${APP_URL}/webhooks/lifecycle` },
      {
        headers: {
          Authentication: `bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
        },
      }
    );
    console.log(`✅ Registrado: app/uninstalled → id ${data.id ?? data.data?.id}`);
  } catch (err) {
    console.error("❌ Error registrando app/uninstalled:", err.response?.data || err.message);
  }

  console.log(
    `\n👉 Los otros 3 (store/redact, customers/redact, customers/data_request) NO se registran acá.\n` +
      `   Configuralos a mano en el panel de socios (config de tu app, sección LGPD/privacidad),\n` +
      `   los 3 apuntando a: ${APP_URL}/webhooks/lifecycle`
  );
}

main().finally(async () => {
  await pool.end();
});
