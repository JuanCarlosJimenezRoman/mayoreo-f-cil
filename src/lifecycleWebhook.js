/**
 * lifecycleWebhook.js
 * -------------------------------------------------------------
 * Maneja los eventos de ciclo de vida de la app y los 3 webhooks de
 * cumplimiento de protección de datos que Tiendanube exige (LGPD y
 * similares):
 *
 *  - app/uninstalled: un comerciante desinstaló la app. Dejamos de
 *    usarla, pero todavía no borramos nada (eso lo pide store/redact
 *    después, por separado).
 *  - store/redact: pedido formal de borrar toda la info de la tienda.
 *  - customers/redact: pedido de borrar info de un cliente puntual.
 *    No guardamos datos de clientes (el carrito se procesa al vuelo
 *    y se descarta), así que no hay nada que borrar — solo
 *    confirmamos recepción.
 *  - customers/data_request: pedido de un cliente de saber qué datos
 *    tenemos de él. Mismo caso: no tenemos nada que reportar.
 *
 * Referencia: https://tiendanube.github.io/api-documentation/resources/webhook#required-webhooks
 * Se registran con scripts/register-required-webhooks.js.
 * -------------------------------------------------------------
 */

const express = require("express");
const { captureRawBody, verifySignature } = require("./webhookSecurity");
const { markStoreUninstalled, deleteStoreCompletely, logError } = require("./db");

const router = express.Router();

router.post(
  "/webhooks/lifecycle",
  captureRawBody,
  verifySignature,
  async (req, res) => {
    res.status(200).send(); // confirmamos recepción rápido, procesamos después

    const { event, store_id: storeIdRaw } = req.body || {};
    const storeId = String(storeIdRaw);

    try {
      switch (event) {
        case "app/uninstalled":
          await markStoreUninstalled(storeId);
          console.log(`[lifecycle] Tienda ${storeId} marcada como desinstalada.`);
          break;

        case "store/redact":
          await deleteStoreCompletely(storeId);
          console.log(`[lifecycle] Datos de la tienda ${storeId} borrados por completo.`);
          break;

        case "customers/redact":
        case "customers/data_request":
          console.log(`[lifecycle] ${event} recibido para tienda ${storeId} — sin datos que reportar/borrar.`);
          break;

        default:
          console.log(`[lifecycle] Evento no manejado: ${event}`);
      }
    } catch (err) {
      console.error("[lifecycle] Error procesando webhook:", err.message);
      await logError(storeId, "webhook-lifecycle", err.message);
    }
  }
);

module.exports = router;
