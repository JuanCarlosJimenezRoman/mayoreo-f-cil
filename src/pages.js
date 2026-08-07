/**
 * pages.js
 * -------------------------------------------------------------
 * Páginas legales/institucionales requeridas para la homologación:
 * política de privacidad y soporte. Mismo sistema visual que la
 * landing y el dashboard.
 *
 * ⚠️ La política de privacidad es una base razonable, no asesoría
 * legal. Antes de publicar en serio, conviene que alguien con
 * conocimiento legal de tu país la revise (sobre todo si vendés a
 * varios países con leyes de datos distintas).
 * -------------------------------------------------------------
 */

const express = require("express");
const router = express.Router();

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "soporte@tuapp.com";
const APP_NAME = process.env.APP_NAME || "Mayoreo App";

function simplePage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — ${APP_NAME}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root { --navy:#10192e; --orange:#e8590c; --text:#1a1d23; --muted:#6b7280; --line:#e4e6ea; }
    body { font-family:'Inter',system-ui,sans-serif; max-width:720px; margin:0 auto; padding:2.5rem 1.5rem 4rem; color:var(--text); line-height:1.65; }
    header { display:flex; align-items:baseline; gap:0.5rem; margin-bottom:2rem; }
    header .dot { width:9px; height:9px; border-radius:50%; background:var(--orange); }
    header h1 { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:1.2rem; text-transform:uppercase; letter-spacing:0.02em; color:var(--navy); margin:0; }
    h2 { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:1.6rem; margin: 2rem 0 0.6rem; }
    h3 { font-size:1.05rem; margin: 1.4rem 0 0.4rem; }
    p, li { color: #333; font-size: 0.95rem; }
    a { color: var(--orange); }
    .updated { color: var(--muted); font-size: 0.85rem; }
    footer { margin-top: 3rem; padding-top:1.5rem; border-top:1px solid var(--line); color: var(--muted); font-size:0.85rem; }
  </style>
</head>
<body>
  <header><span class="dot"></span><h1>${APP_NAME}</h1></header>
  ${bodyHtml}
  <footer>${APP_NAME} · <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></footer>
</body>
</html>`;
}

router.get("/privacidad", (req, res) => {
  res.send(
    simplePage(
      "Política de privacidad",
      `
    <h2>Política de privacidad</h2>
    <p class="updated">Última actualización: ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long" })}</p>

    <h3>Qué datos accedemos</h3>
    <p>Para funcionar, ${APP_NAME} accede — a través de la API oficial de Tiendanube, con la autorización que vos le das al instalar la app — a:</p>
    <ul>
      <li>Información de tu tienda (nombre, dominio, moneda).</li>
      <li>Tu catálogo de productos y categorías (nombres, precios, IDs).</li>
      <li>El contenido del carrito de tus clientes en tiempo real (productos, cantidades, e ID de cliente si está logueado) — únicamente para calcular si corresponde un precio de mayoreo.</li>
    </ul>
    <p>No accedemos a datos de pago, contraseñas, ni información personal de tus clientes más allá del ID interno que Tiendanube nos da para saber si está registrado.</p>

    <h3>Para qué usamos estos datos</h3>
    <p>Exclusivamente para calcular y aplicar precios de mayoreo automáticos en tu tienda. No usamos tus datos ni los de tus clientes para ningún otro fin, ni los combinamos con datos de otras tiendas.</p>

    <h3>Dónde se almacenan</h3>
    <p>Guardamos tu token de acceso, la configuración de mayoreo que definís (categorías, grupos, precios), y un registro básico de errores técnicos, en una base de datos alojada en Render. El contenido de los carritos de tus clientes NO se almacena — se procesa al momento y se descarta.</p>

    <h3>Con quién compartimos datos</h3>
    <p>No compartimos, vendemos, ni cedemos tus datos ni los de tus clientes a terceros. Los únicos datos que salen de nuestro sistema son las respuestas que le devolvemos a la propia API de Tiendanube (el cálculo del descuento).</p>

    <h3>Cuánto tiempo los conservamos</h3>
    <p>Mientras la app esté instalada en tu tienda. Si la desinstalás, podés pedirnos el borrado completo de tus datos escribiéndonos a <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

    <h3>Tus derechos</h3>
    <p>Podés pedirnos en cualquier momento acceso, corrección o borrado de los datos que tengamos sobre tu tienda, escribiéndonos a <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

    <h3>Contacto</h3>
    <p>Ante cualquier duda sobre esta política: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
  `
    )
  );
});

router.get("/soporte", (req, res) => {
  res.send(
    simplePage(
      "Soporte",
      `
    <h2>Soporte</h2>
    <p>¿Tenés alguna duda, problema, o sugerencia sobre ${APP_NAME}? Escribinos y te respondemos a la brevedad.</p>
    <p style="margin: 1.5rem 0;">
      <a href="mailto:${SUPPORT_EMAIL}" style="display:inline-block; background:var(--orange); color:white; padding:0.7rem 1.4rem; border-radius:8px; text-decoration:none; font-weight:600;">Escribirnos a ${SUPPORT_EMAIL}</a>
    </p>

    <h3>Preguntas frecuentes</h3>
    <h3 style="font-size:0.95rem; margin-top:1rem;">¿Cómo entro a mi panel de administración?</h3>
    <p>Al instalar la app te enviamos un link único a tu dashboard. Si lo perdiste, volvé a hacer click en "Configurar" desde el listado de aplicaciones de tu admin de Tiendanube.</p>

    <h3 style="font-size:0.95rem;">¿Los descuentos se ven para todos los clientes?</h3>
    <p>No — el precio de mayoreo solo aplica a clientes con cuenta registrada e iniciada sesión en tu tienda.</p>

    <h3 style="font-size:0.95rem;">¿Cuánto tarda en reflejarse un producto nuevo?</h3>
    <p>Los productos nuevos se sincronizan automáticamente apenas los creás. Si no ves algo actualizado, desde tu dashboard podés forzar una sincronización manual.</p>
  `
    )
  );
});

module.exports = router;
