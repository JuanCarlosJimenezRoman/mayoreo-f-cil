/**
 * scripts/register-product-webhooks.js
 * -------------------------------------------------------------
 * Le dice a Tiendanube que te avise cada vez que se crea, edita o
 * borra un producto, para que tu app sincronice sola sin scripts
 * manuales.
 *
 * Uso:
 *   ACCESS_TOKEN=xxxx STORE_ID=8057813 node scripts/register-product-webhooks.js
 * -------------------------------------------------------------
 */

require("dotenv").config();
const axios = require("axios");

const API_VERSION = "2025-03";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const STORE_ID = process.env.STORE_ID;
const { APP_URL, APP_USER_AGENT } = process.env;

const EVENTS = ["product/created", "product/updated", "product/deleted"];

async function main() {
  if (!ACCESS_TOKEN || !STORE_ID) {
    console.error("⚠️  Pasá ACCESS_TOKEN y STORE_ID como variables de entorno.");
    process.exitCode = 1;
    return;
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

main();
