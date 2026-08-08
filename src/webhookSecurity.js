/**
 * webhookSecurity.js
 * -------------------------------------------------------------
 * Tiendanube firma cada webhook con un header
 * `x-linkedstore-hmac-sha256`, calculado con HMAC-SHA256 sobre el
 * body crudo de la request, usando tu Client Secret. Esto confirma
 * que la request realmente vino de Tiendanube y no de alguien que le
 * pegó a tu URL directamente.
 *
 * Referencia: https://tiendanube.github.io/api-documentation/resources/webhook#verifying-a-webhook
 *
 * Uso: aplicar `captureRawBody` como parser (en vez de express.json()
 * directo) y `verifySignature` como middleware antes del handler.
 * -------------------------------------------------------------
 */

const express = require("express");
const crypto = require("crypto");

// Parsea el JSON pero guarda también el body crudo (buffer), necesario
// para poder recalcular la firma exactamente igual que Tiendanube.
const captureRawBody = express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
});

function verifySignature(req, res, next) {
  const secret = process.env.CLIENT_SECRET;
  const signature =
    req.headers["x-linkedstore-hmac-sha256"] ||
    req.headers["http_x_linkedstore_hmac_sha256"];

  // Modo seguro para el lanzamiento: mientras WEBHOOK_SIGNATURE_ENFORCE
  // no sea exactamente "true", solo AVISAMOS por consola si la firma
  // fallaría, pero dejamos pasar la request igual. Así podés confirmar
  // en los logs de Render que todo firma bien durante unos días, antes
  // de activar el rechazo real y arriesgarte a cortar el mayoreo en
  // vivo por un detalle inesperado (nombre de header, encoding, etc.).
  const enforce = process.env.WEBHOOK_SIGNATURE_ENFORCE === "true";

  if (!secret || !signature || !req.rawBody) {
    console.warn(
      `[webhook] Falta secret, firma, o rawBody en ${req.path}.` +
        (enforce ? " Rechazando (enforce=true)." : " Dejando pasar (enforce=false, solo aviso).")
    );
    return enforce ? res.status(401).send("Firma inválida.") : next();
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex");

  const isValid =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!isValid) {
    console.warn(
      `[webhook] Firma inválida en ${req.path}.` +
        (enforce ? " Rechazando (enforce=true)." : " Dejando pasar (enforce=false, solo aviso).")
    );
    return enforce ? res.status(401).send("Firma inválida.") : next();
  }

  next();
}

module.exports = { captureRawBody, verifySignature };
