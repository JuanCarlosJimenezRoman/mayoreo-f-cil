/**
 * scripts/sync-categories.js
 * -------------------------------------------------------------
 * Trae TODAS las categorías y subcategorías de tu tienda desde
 * Tiendanube, las guarda en la tabla `categories`, y las imprime en
 * pantalla con su ID — así sabés qué ID corresponde a "infantil",
 * "adulto", "unicornio", "elite", etc. para usarlos en
 * seed-tier-rules.js.
 *
 * Uso:
 *   ACCESS_TOKEN=xxxx STORE_ID=8057813 node scripts/sync-categories.js
 * -------------------------------------------------------------
 */

require("dotenv").config();
const axios = require("axios");
const { initDb, upsertCategory, pool } = require("../src/db");

const API_VERSION = "2025-03";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const STORE_ID = process.env.STORE_ID;
const { APP_USER_AGENT } = process.env;

async function main() {
  if (!ACCESS_TOKEN || !STORE_ID) {
    console.error(
      "⚠️  Pasá ACCESS_TOKEN y STORE_ID como variables de entorno."
    );
    process.exitCode = 1;
    return;
  }

  await initDb();

  const { data } = await axios.get(
    `https://api.tiendanube.com/${API_VERSION}/${STORE_ID}/categories`,
    {
      headers: {
        Authentication: `bearer ${ACCESS_TOKEN}`,
        "User-Agent": APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
      },
      params: { per_page: 200 },
    }
  );

  const categories = Array.isArray(data) ? data : data.data || [];

  console.log(`\nEncontré ${categories.length} categorías:\n`);
  console.log("ID".padEnd(12), "NOMBRE".padEnd(30), "PARENT_ID");
  console.log("-".repeat(60));

  for (const cat of categories) {
    const name = cat.name?.es || cat.name || "(sin nombre)";
    console.log(
      String(cat.id).padEnd(12),
      String(name).padEnd(30),
      cat.parent ? String(cat.parent) : "(categoría raíz)"
    );
    await upsertCategory(cat.id, name, cat.parent);
  }

  console.log(
    "\n✅ Categorías guardadas en la base. Copiá los IDs que necesites en scripts/seed-tier-rules.js"
  );
}

main()
  .catch((err) => {
    console.error("❌ Error:", err.response?.data || err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
