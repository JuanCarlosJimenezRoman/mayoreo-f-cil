/**
 * webhook.js
 * -------------------------------------------------------------
 * Este endpoint es el "callback_url" que registramos en promotions.js.
 * Tiendanube lo llama por POST cada vez que un cliente modifica el
 * carrito, enviando todo el estado del carrito.
 *
 * NUEVA LÓGICA (precio fijo por cantidad, agrupado por categoría):
 *  1. Solo clientes REGISTRADOS (logueados) acceden al mayoreo.
 *  2. Cada producto del carrito pertenece a una o más categorías. Esas
 *     categorías están agrupadas en "group_key" (ver category_groups):
 *     por ejemplo, "pulseras-infantil" y "pulseras-adulto" comparten
 *     el group_key "pulseras", así que sus cantidades se SUMAN.
 *     "calcetas-unicornio" y "calcetas-elite" tienen group_keys
 *     distintos, así que cuentan por separado.
 *  3. Para cada group_key, sumamos las unidades totales en el carrito
 *     y buscamos en tier_price_rules el precio por unidad que
 *     corresponde a esa cantidad (el escalón más alto que se cumple).
 *  4. El descuento de cada línea = (precio normal - precio del tier)
 *     × cantidad de esa línea.
 *
 * ⏱️ OJO: 800ms de límite. Toda la data (categorías, agrupaciones,
 * tiers) se lee de Postgres con caché en memoria (ver CACHE_TTL_MS)
 * para no pagar el costo de consultar la base en cada carrito.
 * -------------------------------------------------------------
 */

const express = require("express");
const {
  getStore,
  getCategoriesForProducts,
  getAllCategoryGroups,
  getAllTierRules,
} = require("./db");

const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Caché de promotion_id por tienda
const storeCache = new Map();
async function getPromotionIdCached(storeId) {
  const cached = storeCache.get(storeId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.promotion_id;
  }
  const store = await getStore(storeId);
  const promotionId = store?.promotion_id || null;
  storeCache.set(storeId, { promotion_id: promotionId, fetchedAt: Date.now() });
  return promotionId;
}

// Caché de category_groups y tier_price_rules (cambian poco)
let configCache = null;
let configCacheFetchedAt = 0;
async function getConfigCached() {
  if (configCache && Date.now() - configCacheFetchedAt < CACHE_TTL_MS) {
    return configCache;
  }
  const [categoryGroups, tierRules] = await Promise.all([
    getAllCategoryGroups(),
    getAllTierRules(),
  ]);
  configCache = { categoryGroups, tierRules };
  configCacheFetchedAt = Date.now();
  return configCache;
}

/**
 * Dado el mapa de categorías por producto y el mapa de agrupación,
 * devuelve a qué group_key pertenece un product_id (o null si no
 * tiene mayoreo configurado). Si un producto está en varias
 * categorías agrupadas, se usa la primera que matchee.
 */
function resolveGroupKey(productId, categoriesByProduct, categoryGroups) {
  const categoryIds = categoriesByProduct[productId] || [];
  for (const categoryId of categoryIds) {
    if (categoryGroups[categoryId]) return categoryGroups[categoryId];
  }
  return null;
}

/**
 * Busca en la lista de tiers (ordenada desc por min_qty) el precio
 * por unidad que corresponde a una cantidad dada.
 */
function findTierPrice(tiers, quantity) {
  if (!tiers) return null;
  for (const tier of tiers) {
    if (quantity >= tier.min_qty) return tier.unit_price;
  }
  return null;
}

router.post("/webhooks/discounts", express.json(), async (req, res) => {
  const cart = req.body;

  try {
    const promotionId = await getPromotionIdCached(String(cart.store_id));
    if (!promotionId) return res.status(204).send();

    const isRegisteredCustomer = Boolean(cart.customer && cart.customer.id);
    if (!isRegisteredCustomer) return res.status(204).send();

    const products = cart.products || [];
    const productIds = [...new Set(products.map((p) => String(p.product_id)))];

    const [categoriesByProduct, { categoryGroups, tierRules }] =
      await Promise.all([
        getCategoriesForProducts(productIds),
        getConfigCached(),
      ]);

    // 1. Resolver el group_key de cada línea y sumar cantidades por grupo
    const qtyByGroup = new Map();
    const groupKeyByLine = new Map(); // line id -> group_key

    for (const product of products) {
      const groupKey = resolveGroupKey(
        String(product.product_id),
        categoriesByProduct,
        categoryGroups
      );
      if (!groupKey) continue; // este producto no tiene mayoreo configurado

      groupKeyByLine.set(product.id, groupKey);
      qtyByGroup.set(groupKey, (qtyByGroup.get(groupKey) || 0) + product.quantity);
    }

    // 2. Para cada línea, calcular el descuento según el tier de su grupo
    const lineItemsWithDiscount = [];

    for (const product of products) {
      const groupKey = groupKeyByLine.get(product.id);
      if (!groupKey) continue;

      const totalQtyOfGroup = qtyByGroup.get(groupKey);
      const tierUnitPrice = findTierPrice(tierRules[groupKey], totalQtyOfGroup);
      if (tierUnitPrice === null) continue; // no llega al mínimo de ningún tier

      const normalUnitPrice = parseFloat(product.price);
      if (tierUnitPrice >= normalUnitPrice) continue; // sin descuento real

      const discountAmount = (normalUnitPrice - tierUnitPrice) * product.quantity;

      lineItemsWithDiscount.push({
        line_item: String(product.id),
        discount_specs: {
          type: "fixed",
          amount: discountAmount.toFixed(2),
        },
      });
    }

    if (lineItemsWithDiscount.length === 0) {
      return res.json({
        commands: [
          {
            command: "remove_discount",
            specs: { scope: "cart", promotion_ids: [promotionId] },
          },
        ],
      });
    }

    return res.json({
      commands: [
        {
          command: "create_or_update_discount",
          specs: {
            promotion_id: promotionId,
            currency: cart.currency,
            display_text: { "es-mx": "Precio de mayoreo" },
            line_items: lineItemsWithDiscount,
          },
        },
      ],
    });
  } catch (err) {
    console.error("Error procesando webhook de carrito:", err);
    return res.status(204).send();
  }
});

module.exports = router;
