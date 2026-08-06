/**
 * productWebhook.js
 * -------------------------------------------------------------
 * A diferencia del webhook de descuentos (que tiene 800ms de límite),
 * este es un webhook "normal" de Tiendanube: nos avisa cuando se crea,
 * edita o borra un producto, sin apuro. Lo usamos para mantener
 * actualizada la tabla `product_categories` sin tener que correr
 * sync-products.js a mano cada vez.
 *
 * Se registra con scripts/register-product-webhooks.js.
 * -------------------------------------------------------------
 */

const express = require("express");
const axios = require("axios");
const { getFirstStore, setProductCategories, deleteProduct } = require("./db");

const router = express.Router();
const API_VERSION = "2025-03";
const { APP_USER_AGENT } = process.env;

router.post("/webhooks/products", express.json(), async (req, res) => {
  // Respondemos rápido y procesamos después: acá no hay límite de
  // 800ms, pero igual es buena práctica no dejar a Tiendanube
  // esperando innecesariamente.
  res.status(200).send();

  const { event, id: productId, store_id: storeId } = req.body || {};

  try {
    if (event === "product/deleted") {
      await deleteProduct(productId);
      console.log(`[productos] Borrado product_id=${productId}`);
      return;
    }

    if (event === "product/created" || event === "product/updated") {
      const store = await getFirstStore();
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
      await setProductCategories(productId, categoryIds);
      console.log(
        `[productos] Sincronizado product_id=${productId} → categorías: [${categoryIds.join(", ")}]`
      );
    }
  } catch (err) {
    console.error(
      "[productos] Error procesando webhook:",
      err.response?.data || err.message
    );
  }
});

module.exports = router;
