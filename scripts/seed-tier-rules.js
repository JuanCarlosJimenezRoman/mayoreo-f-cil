/**
 * scripts/seed-tier-rules.js
 * -------------------------------------------------------------
 * Acá cargás tu configuración real de mayoreo: qué categorías se
 * agrupan juntas, y la tabla de precio por cantidad de cada grupo.
 *
 * PASO PREVIO OBLIGATORIO: corré primero scripts/sync-categories.js
 * para ver los IDs reales de tus categorías/subcategorías, y
 * reemplazá los "PEGA_ID_..." de abajo por esos IDs.
 *
 * Uso:
 *   STORE_ID=8057813 node scripts/seed-tier-rules.js
 * (si no pasás STORE_ID, usa la última tienda instalada)
 * -------------------------------------------------------------
 */

require("dotenv").config();
const { initDb, setCategoryGroup, clearTierRules, setTierRule, getFirstStore, pool } = require("../src/db");

// 👇 IDs reales sacados de sync-categories.js (6 de agosto 2026)
const CONFIG = [
  {
    groupKey: "pulseras",
    // Adulto (40235319) + Infantil (40235322) suman para el mismo mayoreo
    categoryIds: ["40235319", "40235322"],
    normalPrice: 60,
    tiers: [
      { minQty: 50, unitPrice: 35 },
      { minQty: 100, unitPrice: 30 },
    ],
  },
  {
    groupKey: "calcetas-unicornio",
    // ⚠️ PENDIENTE: todavía no existe la categoría "Calcetas > Unicornio"
    // en tu tienda. Creála en el admin, volvé a correr
    // sync-categories.js, y reemplazá este ID.
    categoryIds: ["PEGA_ID_CALCETAS_UNICORNIO"],
    normalPrice: 300,
    tiers: [{ minQty: 10, unitPrice: 200 }],
  },
  {
    groupKey: "calcetas-elite",
    // ⚠️ PENDIENTE: mismo caso, falta crear "Calcetas > Elite"
    categoryIds: ["PEGA_ID_CALCETAS_ELITE"],
    normalPrice: 200,
    tiers: [
      { minQty: 10, unitPrice: 150 },
      { minQty: 15, unitPrice: 135 },
    ],
  },
];

async function main() {
  const hasPending = CONFIG.some((g) =>
    g.categoryIds.some((id) => id.startsWith("PEGA_ID_"))
  );
  if (hasPending) {
    console.warn(
      "⚠️  Hay grupos con IDs pendientes (todavía no existen esas categorías en tu tienda).\n" +
        "   Esos grupos se van a SALTAR por ahora; el resto se carga normal.\n"
    );
  }

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

  for (const group of CONFIG) {
    const pending = group.categoryIds.some((id) => id.startsWith("PEGA_ID_"));
    if (pending) {
      console.log(`⏭️  Saltando "${group.groupKey}" (faltan IDs reales).`);
      continue;
    }

    for (const categoryId of group.categoryIds) {
      await setCategoryGroup(STORE_ID, categoryId, group.groupKey);
    }

    await clearTierRules(STORE_ID, group.groupKey);
    for (const tier of group.tiers) {
      await setTierRule(STORE_ID, group.groupKey, tier.minQty, tier.unitPrice);
    }

    console.log(
      `✅ ${group.groupKey}: ${group.categoryIds.length} categoría(s), ${group.tiers.length} escalón(es) de precio.`
    );
  }

  console.log("\n✅ Listo. Reglas de mayoreo cargadas en la base de datos.");
}

main()
  .catch((err) => {
    console.error("❌ Error:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
