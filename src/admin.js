/**
 * admin.js
 * -------------------------------------------------------------
 * Panel de administración: asignar categorías a grupos de mayoreo,
 * editar tablas de precio, resincronizar productos, y monitorear
 * errores. Protegido con usuario/contraseña básica.
 * -------------------------------------------------------------
 */

const express = require("express");
const axios = require("axios");
const {
  getFirstStore,
  getAllCategoryGroups,
  getAllTierRules,
  setCategoryGroup,
  deleteCategoryGroup,
  setTierRule,
  clearTierRules,
  deleteTierRuleGroup,
  setProductCategories,
  getRecentErrors,
  clearErrors,
  getSyncedProductCount,
  getErrorCountSince,
  getProductCountsByGroup,
} = require("./db");

const router = express.Router();
const API_VERSION = "2025-03";
const { APP_USER_AGENT } = process.env;
const TIER_ROWS = 6;

// --- Autenticación básica -----------------------------------------

function basicAuth(req, res, next) {
  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASSWORD || "cambiame";

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
    if (u === user && p === pass) return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Mayoreo Admin"');
  return res.status(401).send("Autenticación requerida.");
}

router.use("/admin", basicAuth, express.urlencoded({ extended: true }));

// --- Helpers --------------------------------------------------------

function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

async function fetchLiveCategories(store) {
  const { data } = await axios.get(
    `https://api.tiendanube.com/${API_VERSION}/${store.store_id}/categories`,
    {
      headers: {
        Authentication: `bearer ${store.access_token}`,
        "User-Agent": APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
      },
      params: { per_page: 200 },
    }
  );
  return Array.isArray(data) ? data : data.data || [];
}

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --navy: #10192e;
      --navy-soft: #1a2740;
      --orange: #e8590c;
      --orange-soft: #fdece1;
      --bg: #f4f5f7;
      --card: #ffffff;
      --line: #e4e6ea;
      --text: #1a1d23;
      --text-muted: #6b7280;
      --green: #1c8a4e;
      --radius: 10px;
      --font-display: 'Barlow Condensed', sans-serif;
      --font-body: 'Inter', system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--orange); }

    .topbar {
      background: var(--navy);
      color: white;
      padding: 1.1rem 1.5rem;
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
    }
    .topbar .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--orange); display: inline-block; margin-right: 0.3rem; }
    .topbar h1 {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.5rem;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      margin: 0;
    }
    .topbar .subtitle { color: #98a2b8; font-size: 0.85rem; }

    .wrap { max-width: 980px; margin: 0 auto; padding: 1.5rem; }

    /* Scoreboard */
    .scoreboard {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    @media (max-width: 700px) { .scoreboard { grid-template-columns: repeat(2, 1fr); } }
    .stat {
      background: var(--navy-soft);
      color: white;
      border-radius: var(--radius);
      padding: 0.9rem 1rem;
      text-align: center;
    }
    .stat .num {
      font-family: var(--font-display);
      font-size: 2.1rem;
      font-weight: 700;
      color: var(--orange);
      line-height: 1;
    }
    .stat .label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #98a2b8;
      margin-top: 0.3rem;
    }
    .stat.alert .num { color: #ff7a7a; }

    h2 {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.3rem;
      letter-spacing: 0.01em;
      margin: 0 0 0.2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    h2 .step { color: var(--orange); }
    .section-intro { color: var(--text-muted); font-size: 0.88rem; margin: 0.2rem 0 1rem; }

    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    input[type=text], input[type=number], input[type=search] {
      width: 100%;
      box-sizing: border-box;
      padding: 0.45rem 0.6rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      font-family: var(--font-body);
      font-size: 0.9rem;
    }
    input:focus, button:focus, a:focus {
      outline: 2px solid var(--orange);
      outline-offset: 1px;
    }

    table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--line); font-size: 0.87rem; vertical-align: middle; }
    th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); }
    tr:hover td { background: #fafafa; }

    .badge {
      display: inline-block;
      background: var(--orange-soft);
      color: var(--orange);
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.1rem 0.5rem;
      border-radius: 20px;
    }

    button {
      background: var(--orange);
      color: white;
      border: none;
      padding: 0.55rem 1.1rem;
      border-radius: 6px;
      cursor: pointer;
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.85rem;
      transition: filter 0.15s;
    }
    button:hover { filter: brightness(0.92); }
    button.secondary { background: transparent; color: var(--text-muted); border: 1px solid var(--line); }
    button.secondary:hover { background: #f3f3f3; }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }

    .group-block { border: 1px solid var(--line); border-radius: var(--radius); padding: 1.1rem; margin-bottom: 1rem; background: #fcfcfd; }
    .group-block h3 { font-family: var(--font-display); font-size: 1.1rem; margin: 0 0 0.6rem; display:flex; align-items:center; gap:0.5rem; }
    .group-actions { display: flex; gap: 0.5rem; margin-top: 0.7rem; align-items: center; }

    .muted { color: var(--text-muted); font-size: 0.85rem; }
    .msg { background: #e9f7ee; border: 1px solid var(--green); color: #0d5c30; padding: 0.6rem 1rem; border-radius: 6px; margin-bottom: 1.2rem; font-size: 0.88rem; }
    .empty { padding: 1.2rem; text-align: center; color: var(--text-muted); font-size: 0.88rem; border: 1px dashed var(--line); border-radius: var(--radius); }

    footer { text-align: center; color: var(--text-muted); font-size: 0.78rem; padding: 2rem 0 1rem; }
  </style>
</head>
<body>
  <div class="topbar">
    <span class="dot"></span>
    <h1>Mayoreo</h1>
    <span class="subtitle">· panel de administración</span>
  </div>
  <div class="wrap">
    ${body}
  </div>
  <footer>Mayoreo App — hecho a medida para tu tienda</footer>
  <script>
    // Confirmación antes de acciones destructivas
    document.querySelectorAll('[data-confirm]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        if (!confirm(form.dataset.confirm)) e.preventDefault();
      });
    });
    // Buscador de categorías (filtra filas de la tabla en vivo)
    const searchInput = document.getElementById('category-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        document.querySelectorAll('#category-table tbody tr').forEach((row) => {
          row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }
  </script>
</body>
</html>`;
}

// --- GET /admin: página principal -----------------------------------

router.get("/admin", async (req, res) => {
  try {
    const store = await getFirstStore();
    if (!store) {
      return res.send(
        layout("Mayoreo Admin", '<div class="empty">Todavía no hay ninguna tienda instalada.</div>')
      );
    }

    const [categories, categoryGroups, tierRules, productCounts, syncedCount, errorCount7d, recentErrors] =
      await Promise.all([
        fetchLiveCategories(store),
        getAllCategoryGroups(),
        getAllTierRules(),
        getProductCountsByGroup(),
        getSyncedProductCount(),
        getErrorCountSince(7),
        getRecentErrors(20),
      ]);

    const nameById = {};
    for (const c of categories) nameById[c.id] = c.name?.es || c.name || c.id;

    // --- Scoreboard ---
    const categoriesWithMayoreo = Object.keys(categoryGroups).length;
    const allGroupKeys = [
      ...new Set([...Object.values(categoryGroups), ...Object.keys(tierRules)]),
    ].filter(Boolean);

    const scoreboard = `
      <div class="scoreboard">
        <div class="stat"><div class="num">${categoriesWithMayoreo}</div><div class="label">Categorías con mayoreo</div></div>
        <div class="stat"><div class="num">${allGroupKeys.length}</div><div class="label">Grupos activos</div></div>
        <div class="stat"><div class="num">${syncedCount}</div><div class="label">Productos sincronizados</div></div>
        <div class="stat ${errorCount7d > 0 ? "alert" : ""}"><div class="num">${errorCount7d}</div><div class="label">Errores (7 días)</div></div>
      </div>
    `;

    // --- Sección 1: categorías ---
    const categoryRows = categories
      .map((c) => {
        const currentGroup = categoryGroups[c.id] || "";
        const parentName = c.parent ? nameById[c.parent] || c.parent : "—";
        return `<tr>
          <td>${escapeHtml(nameById[c.id])}</td>
          <td class="muted">${escapeHtml(parentName)}</td>
          <td class="muted">${c.id}</td>
          <td><input type="text" name="group_key__${c.id}" value="${escapeHtml(currentGroup)}" placeholder="ej: pulseras (vacío = sin mayoreo)"></td>
        </tr>`;
      })
      .join("");

    const section1 = `
      <h2><span class="step">1.</span> Categorías → grupos de mayoreo</h2>
      <p class="section-intro">Categorías con el mismo nombre de grupo SUMAN sus cantidades (ej: escribí "pulseras" en Infantil y en Adulto). Dejá vacío si esa categoría no tiene mayoreo.</p>
      <div class="card">
        <input type="search" id="category-search" placeholder="Buscar categoría..." style="margin-bottom:0.8rem">
        <form method="POST" action="/admin/category-groups">
          <table id="category-table">
            <tr><th>Categoría</th><th>Subcategoría de</th><th>ID</th><th>Grupo de mayoreo</th></tr>
            <tbody>${categoryRows}</tbody>
          </table>
          <button type="submit">Guardar asignaciones</button>
        </form>
      </div>
    `;

    // --- Sección 2: tiers por grupo ---
    const groupBlocks = allGroupKeys
      .map((groupKey) => {
        const tiers = tierRules[groupKey] || [];
        const sortedTiers = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
        const productCount = productCounts[groupKey] || 0;

        const rows = Array.from({ length: TIER_ROWS })
          .map((_, i) => {
            const tier = sortedTiers[i];
            return `<tr>
              <td><input type="number" name="min_qty_${i}" value="${tier ? tier.min_qty : ""}" placeholder="cantidad mínima"></td>
              <td><input type="number" step="0.01" name="unit_price_${i}" value="${tier ? tier.unit_price : ""}" placeholder="precio por unidad"></td>
            </tr>`;
          })
          .join("");

        return `<div class="group-block">
          <h3>${escapeHtml(groupKey)} <span class="badge">${productCount} producto${productCount === 1 ? "" : "s"}</span></h3>
          <form method="POST" action="/admin/tier-rules">
            <input type="hidden" name="group_key" value="${escapeHtml(groupKey)}">
            <table>
              <tr><th>Cantidad mínima</th><th>Precio por unidad</th></tr>
              ${rows}
            </table>
            <div class="group-actions">
              <button type="submit">Guardar tabla de precios</button>
            </div>
          </form>
          <form method="POST" action="/admin/tier-rules/delete" data-confirm="¿Borrar el grupo &quot;${groupKey}&quot; y toda su tabla de precios? Esta acción no se puede deshacer." style="margin-top:0.4rem">
            <input type="hidden" name="group_key" value="${escapeHtml(groupKey)}">
            <button type="submit" class="secondary">Borrar grupo completo</button>
          </form>
        </div>`;
      })
      .join("");

    const section2 = `
      <h2><span class="step">2.</span> Tablas de precio por grupo</h2>
      <p class="section-intro">Dejá filas vacías si un grupo tiene menos de ${TIER_ROWS} escalones. Para crear un grupo nuevo, asignáselo primero a una categoría arriba.</p>
      ${groupBlocks || '<div class="empty">Todavía no armaste ningún grupo. Asignale un nombre de grupo a una categoría en la sección 1 para empezar.</div>'}
    `;

    // --- Sección 3: resync manual ---
    const section3 = `
      <h2><span class="step">3.</span> Sincronización de productos</h2>
      <p class="section-intro">Los productos nuevos se sincronizan solos vía webhooks. Usá esto solo si sospechás que algo quedó desactualizado.</p>
      <div class="card">
        <form method="POST" action="/admin/sync-products">
          <button type="submit">Sincronizar productos ahora</button>
        </form>
      </div>
    `;

    // --- Sección 4: monitoreo ---
    const errorRows = recentErrors
      .map(
        (e) => `<tr>
          <td class="muted">${new Date(e.created_at).toLocaleString("es-MX")}</td>
          <td>${escapeHtml(e.source)}</td>
          <td>${escapeHtml(e.message)}</td>
        </tr>`
      )
      .join("");

    const section4 = `
      <h2><span class="step">4.</span> Monitoreo</h2>
      <p class="section-intro">Errores capturados por el webhook de descuentos y el de productos.</p>
      <div class="card">
        ${
          recentErrors.length > 0
            ? `<table><tr><th>Cuándo</th><th>Origen</th><th>Mensaje</th></tr>${errorRows}</table>
               <form method="POST" action="/admin/clear-errors" data-confirm="¿Borrar el historial de errores?" style="margin-top:0.6rem">
                 <button type="submit" class="secondary">Limpiar errores</button>
               </form>`
            : '<div class="empty">✅ Sin errores registrados.</div>'
        }
        <p class="muted" style="margin-top:1rem">
          💡 Para que te avisen si el servidor se cae, configurá un monitor gratis en
          <a href="https://uptimerobot.com" target="_blank" rel="noopener">UptimeRobot</a> apuntando a:
          <code>${escapeHtml((process.env.APP_URL || "") + "/")}</code>
        </p>
      </div>
    `;

    const savedMsg = req.query.saved ? `<div class="msg">✅ Cambios guardados.</div>` : "";

    res.send(
      layout("Mayoreo Admin", savedMsg + scoreboard + section1 + section2 + section3 + section4)
    );
  } catch (err) {
    console.error("[admin] Error:", err.response?.data || err.message);
    res.status(500).send("Error cargando el panel: " + escapeHtml(err.message));
  }
});

// --- POST /admin/category-groups -------------------------------------

router.post("/admin/category-groups", async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (!key.startsWith("group_key__")) continue;
      const categoryId = key.replace("group_key__", "");
      const groupKey = value.trim();

      if (groupKey === "") {
        await deleteCategoryGroup(categoryId);
      } else {
        await setCategoryGroup(categoryId, groupKey);
      }
    }
    res.redirect("/admin?saved=1");
  } catch (err) {
    console.error("[admin] Error guardando category-groups:", err.message);
    res.status(500).send("Error guardando: " + escapeHtml(err.message));
  }
});

// --- POST /admin/tier-rules -------------------------------------------

router.post("/admin/tier-rules", async (req, res) => {
  try {
    const groupKey = req.body.group_key;
    if (!groupKey) return res.redirect("/admin");

    await clearTierRules(groupKey);

    for (let i = 0; i < TIER_ROWS; i++) {
      const minQty = req.body[`min_qty_${i}`];
      const unitPrice = req.body[`unit_price_${i}`];
      if (minQty === "" || unitPrice === "" || minQty == null || unitPrice == null) {
        continue;
      }
      await setTierRule(groupKey, parseInt(minQty, 10), parseFloat(unitPrice));
    }

    res.redirect("/admin?saved=1");
  } catch (err) {
    console.error("[admin] Error guardando tier-rules:", err.message);
    res.status(500).send("Error guardando: " + escapeHtml(err.message));
  }
});

// --- POST /admin/tier-rules/delete -------------------------------------

router.post("/admin/tier-rules/delete", async (req, res) => {
  try {
    const groupKey = req.body.group_key;
    if (groupKey) await deleteTierRuleGroup(groupKey);
    res.redirect("/admin?saved=1");
  } catch (err) {
    console.error("[admin] Error borrando grupo:", err.message);
    res.status(500).send("Error borrando: " + escapeHtml(err.message));
  }
});

// --- POST /admin/sync-products (resync manual) ---------------------------

router.post("/admin/sync-products", async (req, res) => {
  try {
    const store = await getFirstStore();
    if (!store) return res.redirect("/admin");

    let page = 1;
    while (true) {
      let data;
      try {
        const response = await axios.get(
          `https://api.tiendanube.com/${API_VERSION}/${store.store_id}/products`,
          {
            headers: {
              Authentication: `bearer ${store.access_token}`,
              "User-Agent":
                APP_USER_AGENT || "Mayoreo App (tu-email@ejemplo.com)",
            },
            params: { per_page: 50, page },
          }
        );
        data = response.data;
      } catch (err) {
        const isLastPageError =
          err.response?.status === 404 &&
          /last page/i.test(err.response?.data?.description || "");
        if (isLastPageError) break;
        throw err;
      }

      const products = Array.isArray(data) ? data : data.data || [];
      if (products.length === 0) break;

      for (const product of products) {
        const categoryIds = (product.categories || []).map((c) => c.id);
        await setProductCategories(product.id, categoryIds);
      }
      page++;
    }

    res.redirect("/admin?saved=1");
  } catch (err) {
    console.error("[admin] Error sincronizando productos:", err.message);
    res.status(500).send("Error sincronizando: " + escapeHtml(err.message));
  }
});

// --- POST /admin/clear-errors --------------------------------------

router.post("/admin/clear-errors", async (req, res) => {
  try {
    await clearErrors();
    res.redirect("/admin?saved=1");
  } catch (err) {
    console.error("[admin] Error limpiando errores:", err.message);
    res.status(500).send("Error: " + escapeHtml(err.message));
  }
});

module.exports = router;
