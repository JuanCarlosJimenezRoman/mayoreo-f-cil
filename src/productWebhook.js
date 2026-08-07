/**
 * productWebhook.js
 * -------------------------------------------------------------
 * A diferencia del webhook de descuentos (que tiene 800ms de límite),
 * este es un webhook "normal" de Tiendanube: nos avisa cuando se crea,
 * edita o borra un producto, sin apuro. Lo usamos para mantener
 * actualizada la tabla `product_categories` sin tener que correr
 * sync-products.js a mano cada vez.
 *
 * Usa el store_id que viene en el propio payload del webhook (no
 * asume "la única tienda") para que funcione con múltiples tiendas
 * instaladas al mismo tiempo.
 *
 * Se registra con scripts/register-product-webhooks.js.
 * -------------------------------------------------------------
 */

const express = require("express");
const axios = require("axios");
const { getStore, setProductCategories, deleteProduct, logError } = require("./db");

const router = express.Router();
const API_VERSION = "2025-03";
const { APP_USER_AGENT } = process.env;

router.post("/webhooks/products", express.json(), async (req, res) => {
  // Respondemos rápido y procesamos después: acá no hay límite de
  // 800ms, pero igual es buena práctica no dejar a Tiendanube
  // esperando innecesariamente.
  res.status(200).send();

  const { event, id: productId, store_id: storeIdRaw } = req.body || {};
  const storeId = String(storeIdRaw);

  try {
    if (event === "product/deleted") {
      await deleteProduct(storeId, productId);
      console.log(`[productos] Borrado product_id=${productId} (tienda ${storeId})`);
      return;
    }

    if (event === "product/created" || event === "product/updated") {
      const store = await getStore(storeId);
      if (!store) return;

      const { data } = await axios.get(
        `https://api.tiendanube.com/${API_VERSION}/${storeId}/products/${productId}`,
        {
          headers: {
            Authentication: `bearer ${store.access_token}`,
            "User-Agent":
              APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
          },
        }
      );

      const categoryIds = (data.categories || []).map((c) => c.id);
      await setProductCategories(storeId, productId, categoryIds);
      console.log(
        `[productos] Sincronizado product_id=${productId} (tienda ${storeId}) → categorías: [${categoryIds.join(", ")}]`
      );
    }
  } catch (err) {
    console.error(
      "[productos] Error procesando webhook:",
      err.response?.data || err.message
    );
    await logError(
      storeId,
      "webhook-products",
      JSON.stringify(err.response?.data) || err.message
    );
  }
});

module.exports = router;
