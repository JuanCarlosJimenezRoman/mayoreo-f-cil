/**
 * auth.js
 * -------------------------------------------------------------
 * Implementa el flujo OAuth2 de Tiendanube/Nuvemshop:
 *  1. El comerciante instala tu app -> Tiendanube lo redirige a tu
 *     redirect_uri con un "code".
 *  2. Vos cambiás ese "code" por un access_token haciendo un POST a
 *     https://www.tiendanube.com/apps/authorize/token
 *  3. Guardás el access_token asociado al store_id (user_id en la
 *     respuesta) para usarlo en cada llamada futura a la API.
 *  4. Aprovechamos ese mismo momento para registrar la promoción
 *     de mayoreo (ver promotions.js).
 *
 * Referencia oficial:
 * https://tiendanube.github.io/api-documentation/authentication
 * -------------------------------------------------------------
 */

const express = require("express");
const axios = require("axios");
const { saveStore } = require("./db");
const { registerPromotion } = require("./promotions");

const router = express.Router();

const { CLIENT_ID, CLIENT_SECRET, APP_URL } = process.env;

// Paso 1: botón/link de instalación. Tiendanube ya te da esta URL
// cuando creás la app en el panel de socios, pero la dejamos acá
// como referencia: https://www.tiendanube.com/apps/{app_id}/authorize

// Paso 2: Tiendanube redirige acá con ?code=xxxx
router.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Falta el parámetro 'code'.");
  }

  try {
    const tokenResponse = await axios.post(
      "https://www.tiendanube.com/apps/authorize/token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const { access_token, token_type, scope, user_id } = tokenResponse.data;
    const storeId = String(user_id);

    await saveStore(storeId, { access_token, scope });

    // Registramos automáticamente la promoción de mayoreo apenas
    // se instala la app, así el comerciante no tiene que hacer nada más.
    const promotionId = await registerPromotion(storeId, access_token);
    await saveStore(storeId, { promotion_id: promotionId });

    res.send(
      "¡App instalada correctamente! Ya podés cerrar esta pestaña y volver al admin de tu tienda."
    );
  } catch (err) {
    console.error(
      "Error en el intercambio OAuth:",
      err.response?.data || err.message
    );
    res.status(500).send("Hubo un error autenticando la app.");
  }
});

module.exports = router;
