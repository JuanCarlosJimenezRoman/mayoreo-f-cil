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
 *  4. Registrás la promoción de mayoreo automáticamente.
 *  5. Generás un "magic link" único para el dashboard de ESA tienda,
 *     y redirigís al comerciante directo ahí — no necesita usuario
 *     ni contraseña, el link en sí es su credencial.
 *
 * Referencia oficial:
 * https://tiendanube.github.io/api-documentation/authentication
 * -------------------------------------------------------------
 */

const express = require("express");
const axios = require("axios");
const { saveStore, ensureAdminToken } = require("./db");
const { registerPromotion } = require("./promotions");

const router = express.Router();

const { CLIENT_ID, CLIENT_SECRET, APP_URL } = process.env;

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

    const { access_token, scope, user_id } = tokenResponse.data;
    const storeId = String(user_id);

    await saveStore(storeId, { access_token, scope });

    const promotionId = await registerPromotion(storeId, access_token);
    await saveStore(storeId, { promotion_id: promotionId });

    const adminToken = await ensureAdminToken(storeId);
    const dashboardUrl = `${APP_URL}/admin?token=${adminToken}`;

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><title>App instalada</title></head>
      <body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 4rem auto; text-align: center;">
        <h1>✅ ¡App instalada correctamente!</h1>
        <p>Tu panel de administración de mayoreo ya está listo.</p>
        <p><a href="${dashboardUrl}" style="display:inline-block; background:#e8590c; color:white; padding:0.7rem 1.4rem; border-radius:6px; text-decoration:none; font-weight:600;">Ir a mi panel de mayoreo</a></p>
        <p style="color:#777; font-size:0.85rem;">Guardá este link — es tu acceso directo, no hace falta usuario ni contraseña.</p>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(
      "Error en el intercambio OAuth:",
      err.response?.data || err.message
    );
    res.status(500).send("Hubo un error autenticando la app.");
  }
});

module.exports = router;
