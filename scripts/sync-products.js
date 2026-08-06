/**
 * scripts/sync-products.js
 * -------------------------------------------------------------
 * Trae TODOS los productos de tu tienda y guarda a qué categoría(s)
 * pertenece cada uno, en la tabla `product_categories`. Esto es lo
 * que le permite al webhook saber, sin llamar a la API en el momento,
 * a qué categoría pertenece cada producto del carrito.
 *
 * ⚠️ Esto es una sincronización manual/inicial. Si agregás productos
 * nuevos o les cambiás la categoría en Tiendanube más adelante, hay
 * que volver a correr este script (o, mejor, configurar webhooks de
 * `product/created` y `product/updated` — lo dejamos pendiente como
 * mejora futura, ver README).
 *
 * Uso:
 *   ACCESS_TOKEN=xxxx STORE_ID=8057813 node scripts/sync-products.js
 * -------------------------------------------------------------
 */

require("dotenv").config();
const axios = require("axios");
const { initDb, setProductCategories, pool } = require("../src/db");

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

  let page = 1;
  let totalSynced = 0;
  let sinCategoria = [];

  while (true) {
    let data;
    try {
      const response = await axios.get(
        `https://api.tiendanube.com/${API_VERSION}/${STORE_ID}/products`,
        {
          headers: {
            Authentication: `bearer ${ACCESS_TOKEN}`,
            "User-Agent":
              APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
          },
          params: { per_page: 50, page },
        }
      );
      data = response.data;
    } catch (err) {
      // La API devuelve 404 "Last page is N" cuando pedís una página
      // que ya no existe — es la forma en que nos avisa que terminamos,
      // no un error real.
      const isLastPageError =
        err.response?.status === 404 &&
        /last page/i.test(err.response?.data?.description || "");
      if (isLastPageError) break;
      throw err; // cualquier otro error sí es real, lo dejamos explotar
    }

    const products = Array.isArray(data) ? data : data.data || [];
    if (products.length === 0) break;

    for (const product of products) {
      const categoryIds = (product.categories || []).map((c) => c.id);
      await setProductCategories(product.id, categoryIds);
      const name = product.name?.es || product.name || "(sin nombre)";
      console.log(
        `  ${product.id} — ${name} → categorías: [${categoryIds.join(", ")}]`
      );
      if (categoryIds.length === 0) sinCategoria.push(`${product.id} (${name})`);
      totalSynced++;
    }

    page++;
  }

  console.log(`\n✅ Sincronizados ${totalSynced} productos.`);

  if (sinCategoria.length > 0) {
    console.log(
      `\n⚠️  ${sinCategoria.length} producto(s) sin ninguna categoría asignada ` +
        `(no van a recibir mayoreo hasta que les asignes una en Tiendanube):`
    );
    sinCategoria.forEach((p) => console.log(`   - ${p}`));
  }
}

main()
  .catch((err) => {
    console.error("❌ Error:", err.response?.data || err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
