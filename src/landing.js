/**
 * landing.js
 * -------------------------------------------------------------
 * Página pública en "/" explicando qué hace la app. Pensada para
 * enlazar desde el listado de la Tienda de Aplicaciones de Tiendanube
 * una vez que pase homologación, y mientras tanto sirve como página
 * de referencia para mostrarle a comerciantes interesados.
 *
 * Editá PRICE_MONTHLY, TRIAL_DAYS y SUPPORT_EMAIL según corresponda.
 * -------------------------------------------------------------
 */

const express = require("express");
const router = express.Router();

const PRICE_MONTHLY = process.env.PRICE_MONTHLY || "$299 MXN";
const TRIAL_DAYS = 15;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "soporte@tuapp.com";

router.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mayoreo — Precios por cantidad para tu tienda Tiendanube</title>
  <meta name="description" content="Ofrecé precios de mayoreo automáticos por cantidad y categoría a tus clientes registrados, sin cupones ni límites de plan.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --navy: #10192e;
      --navy-soft: #1a2740;
      --orange: #e8590c;
      --orange-soft: #fdece1;
      --bg: #f4f5f7;
      --line: #e4e6ea;
      --text: #1a1d23;
      --text-muted: #6b7280;
      --font-display: 'Barlow Condensed', sans-serif;
      --font-body: 'Inter', system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin:0; font-family: var(--font-body); color: var(--text); background: var(--bg); -webkit-font-smoothing:antialiased; }
    a { color: var(--orange); }
    .wrap { max-width: 960px; margin: 0 auto; padding: 0 1.5rem; }

    header.top { background: var(--navy); color: white; padding: 1.1rem 0; }
    header.top .wrap { display:flex; align-items:baseline; gap:0.5rem; }
    header.top .dot { width:10px; height:10px; border-radius:50%; background:var(--orange); display:inline-block; }
    header.top h1 { font-family: var(--font-display); font-weight:700; font-size:1.4rem; text-transform:uppercase; letter-spacing:0.02em; margin:0; }

    .hero { background: var(--navy); color: white; padding: 3.5rem 0 4rem; }
    .hero .wrap { display:grid; grid-template-columns: 1.1fr 0.9fr; gap: 2.5rem; align-items:center; }
    @media (max-width: 800px) { .hero .wrap { grid-template-columns: 1fr; } }
    .hero h2 {
      font-family: var(--font-display); font-weight:700; font-size: 2.6rem; line-height:1.05;
      text-transform: uppercase; letter-spacing: 0.01em; margin: 0 0 1rem;
    }
    .hero h2 span { color: var(--orange); }
    .hero p.lead { color: #b9c2d4; font-size: 1.05rem; line-height:1.6; margin: 0 0 1.8rem; max-width: 480px; }
    .cta {
      display:inline-block; background: var(--orange); color:white; font-weight:700; text-decoration:none;
      padding: 0.85rem 1.6rem; border-radius:8px; font-size:0.95rem;
    }
    .cta.secondary { background: transparent; border: 1px solid #3a4763; margin-left: 0.7rem; }

    .scoreboard-mock { background: var(--navy-soft); border-radius: 14px; padding: 1.5rem; border: 1px solid #263353; }
    .scoreboard-mock .row { display:flex; justify-content:space-between; padding: 0.5rem 0; border-bottom: 1px solid #263353; font-size: 0.85rem; color: #b9c2d4; }
    .scoreboard-mock .row:last-child { border-bottom:none; }
    .scoreboard-mock .row b { color: white; font-family: var(--font-display); font-size: 1.1rem; }
    .scoreboard-mock .discount { color: #4ade80; font-weight: 600; }

    section { padding: 3.5rem 0; }
    section.alt { background: white; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    h3.section-title {
      font-family: var(--font-display); font-weight:700; font-size:1.8rem; text-transform:uppercase;
      letter-spacing:0.01em; margin: 0 0 0.5rem; text-align:center;
    }
    p.section-sub { text-align:center; color: var(--text-muted); max-width: 520px; margin: 0 auto 2.5rem; }

    .steps { display:grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
    @media (max-width: 700px) { .steps { grid-template-columns: 1fr; } }
    .step-card { background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 1.5rem; }
    .step-card .n {
      font-family: var(--font-display); font-weight:700; font-size:2rem; color: var(--orange);
      line-height:1; margin-bottom: 0.6rem;
    }
    .step-card h4 { margin: 0 0 0.4rem; font-size: 1rem; }
    .step-card p { margin:0; color: var(--text-muted); font-size: 0.9rem; line-height:1.5; }

    .pricing-card {
      max-width: 380px; margin: 0 auto; background: var(--navy); color: white; border-radius: 16px;
      padding: 2rem; text-align:center;
    }
    .pricing-card .price { font-family: var(--font-display); font-size: 3rem; font-weight:700; color: var(--orange); }
    .pricing-card .price span { font-size: 1rem; color: #b9c2d4; font-family: var(--font-body); }
    .pricing-card ul { list-style:none; padding:0; margin: 1.5rem 0; text-align:left; }
    .pricing-card li { padding: 0.4rem 0; color: #d5dbe8; font-size: 0.9rem; }
    .pricing-card li:before { content: "✓ "; color: #4ade80; font-weight:700; }
    .trial-note { text-align:center; color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem; }

    footer { padding: 2.5rem 0; text-align:center; color: var(--text-muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <header class="top">
    <div class="wrap"><span class="dot"></span><h1>Mayoreo</h1></div>
  </header>

  <section class="hero">
    <div class="wrap">
      <div>
        <h2>Precios de <span>mayoreo</span> que se aplican solos</h2>
        <p class="lead">Ofrecé descuentos por cantidad y categoría a tus clientes registrados, directo en el carrito — sin cupones, sin límites de plan, sin que el cliente tenga que hacer nada extra.</p>
        <a class="cta" href="mailto:${SUPPORT_EMAIL}?subject=Quiero%20probar%20Mayoreo">Empezar prueba gratis</a>
        <a class="cta secondary" href="mailto:${SUPPORT_EMAIL}?subject=Tengo%20una%20pregunta%20sobre%20Mayoreo">Hablar con nosotros</a>
      </div>
      <div class="scoreboard-mock">
        <div class="row"><span>Pulseras Kobe Bryant</span><b>10 u.</b></div>
        <div class="row"><span>Precio normal</span><span>$60.00</span></div>
        <div class="row"><span>Precio de mayoreo</span><span class="discount">$35.00</span></div>
        <div class="row"><span>Ahorro del cliente</span><span class="discount">-$250.00</span></div>
      </div>
    </div>
  </section>

  <section class="alt">
    <div class="wrap">
      <h3 class="section-title">Cómo funciona</h3>
      <p class="section-sub">Configurás una vez, y queda funcionando solo — incluso cuando agregás productos nuevos.</p>
      <div class="steps">
        <div class="step-card">
          <div class="n">1</div>
          <h4>Agrupá tus categorías</h4>
          <p>Elegí qué categorías (o combinaciones de subcategorías) tienen precio de mayoreo.</p>
        </div>
        <div class="step-card">
          <div class="n">2</div>
          <h4>Definí tu tabla de precios</h4>
          <p>Cantidad mínima → precio por unidad. Tantos escalones como necesites, por grupo.</p>
        </div>
        <div class="step-card">
          <div class="n">3</div>
          <h4>Listo</h4>
          <p>El descuento aparece solo en el carrito para clientes registrados, y se mantiene al día con tu catálogo.</p>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <h3 class="section-title">Precio simple</h3>
      <p class="section-sub">Sin comisión sobre tus ventas. Un precio fijo mensual.</p>
      <div class="pricing-card">
        <div class="price">${PRICE_MONTHLY}<span>/mes</span></div>
        <ul>
          <li>Categorías y grupos ilimitados</li>
          <li>Escalones de precio ilimitados</li>
          <li>Sincronización automática de productos</li>
          <li>Panel de administración incluido</li>
        </ul>
        <a class="cta" href="mailto:${SUPPORT_EMAIL}?subject=Quiero%20probar%20Mayoreo" style="width:100%">Empezar prueba gratis</a>
      </div>
      <p class="trial-note">${TRIAL_DAYS} días gratis, sin tarjeta. Cancelás cuando quieras.</p>
    </div>
  </section>

  <footer>
    <div class="wrap">
      Mayoreo App — hecha para tiendas Tiendanube · <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
      · <a href="/privacidad">Privacidad</a> · <a href="/soporte">Soporte</a>
    </div>
  </footer>
</body>
</html>`);
});

module.exports = router;
