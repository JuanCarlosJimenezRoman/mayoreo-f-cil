/**
 * promotions.js
 * -------------------------------------------------------------
 * Registra la "promoción" de mayoreo en Tiendanube. Esto es lo que
 * le avisa a la tienda "che, avisame de cada cambio en el carrito
 * a esta URL, porque puede que yo tenga un descuento para aplicar".
 *
 * ⚠️ IMPORTANTE - A VERIFICAR ANTES DE PRODUCCIÓN:
 * La documentación pública de la Discount API confirma el formato de
 * los "commands" del webhook (create_or_update_discount, etc.) con
 * total detalle, pero NO publica el JSON exacto y completo que espera
 * el POST /promotions (solo dice que existe y linkea a un openapi.yml).
 * El body de abajo es mi mejor estimación en base a los nombres de
 * propiedades que sí menciona la doc (name, allocation_type, active,
 * combination settings, callback_url), pero antes de ir a producción:
 *
 *   1. Andá a tu panel de socio > tu app > Discount API / Webhooks.
 *   2. Revisá el archivo openapi.yml enlazado ahí (o pedile soporte a
 *      Tiendanube en api@tiendanube.com) para confirmar los nombres
 *      exactos de los campos.
 *   3. Ajustá el objeto "body" de abajo si hace falta.
 *
 * Esto es a propósito: preferí darte una base honesta y clara sobre qué
 * está confirmado y qué no, en vez de inventar campos que después te
 * hagan perder tiempo debuggeando.
 * -------------------------------------------------------------
 */

const axios = require("axios");

const API_VERSION = "2025-03";
const { APP_URL, APP_USER_AGENT } = process.env;

async function registerPromotion(storeId, accessToken) {
  const body = {
    name: "Mayoreo BASKATBALL 23",
    allocation_type: "line_item", // el descuento se aplica producto por producto
    active: true,
    callback_url: `${APP_URL}/webhooks/discounts`,
  };

  const response = await axios.post(
    `https://api.tiendanube.com/${API_VERSION}/${storeId}/promotions`,
    body,
    {
      headers: {
        Authentication: `bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
      },
    }
  );

  return response.data.id;
}

module.exports = { registerPromotion };
