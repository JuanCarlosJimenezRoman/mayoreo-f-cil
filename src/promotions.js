/**
 * promotions.js
 * -------------------------------------------------------------
 * Registra la "promoción" de mayoreo en Tiendanube, y por separado
 * registra la URL de callback (a donde Tiendanube manda el estado
 * del carrito en cada cambio).
 *
 * Nota: aprendimos en la práctica que `callback_url` NO va dentro del
 * body de POST /promotions (la API devuelve 400 si lo mandás ahí). El
 * callback se registra aparte con PUT /discounts/callbacks.
 *
 * ⚠️ El campo exacto del body de PUT /discounts/callbacks (le puse
 * "url") es mi mejor estimación en base a los nombres típicos que usa
 * esta API en otros lados. Si la API responde con un error de
 * "property X should not exist" o "X is required", significa que el
 * campo real se llama distinto — la buena noticia es que la API te lo
 * va a decir explícitamente en el mensaje de error, así que solo hay
 * que ajustar el nombre acá.
 * -------------------------------------------------------------
 */

const axios = require("axios");

const API_VERSION = "2025-03";
const { APP_URL, APP_USER_AGENT } = process.env;

function authHeaders(accessToken) {
  return {
    Authentication: `bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
  };
}

async function registerCallback(storeId, accessToken) {
  const callbackUrl = `${APP_URL}/webhooks/discounts`;

  const response = await axios.put(
    `https://api.tiendanube.com/${API_VERSION}/${storeId}/discounts/callbacks`,
    { url: callbackUrl },
    { headers: authHeaders(accessToken) }
  );

  return response.data;
}

async function registerPromotion(storeId, accessToken) {
  // Primero registramos a dónde debe avisarnos Tiendanube de cada
  // cambio de carrito.
  await registerCallback(storeId, accessToken);

  const body = {
    name: "Mayoreo BASKATBALL 23",
    allocation_type: "line_item", // el descuento se aplica producto por producto
    active: true,
  };

  const response = await axios.post(
    `https://api.tiendanube.com/${API_VERSION}/${storeId}/promotions`,
    body,
    { headers: authHeaders(accessToken) }
  );

  // La API a veces envuelve la respuesta en un campo "data" (lo vimos
  // en GET /promotions) y a veces no. Contemplamos los dos casos.
  const id = response.data?.id ?? response.data?.data?.id;

  if (!id) {
    console.warn(
      "⚠️  No se encontró un 'id' en la respuesta de POST /promotions. " +
        "Respuesta completa recibida:",
      JSON.stringify(response.data, null, 2)
    );
  }

  return id;
}

module.exports = { registerPromotion, registerCallback };
