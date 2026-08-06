/**
 * admin.js
 * -------------------------------------------------------------
 * Panel de administración simple (HTML plano, sin frameworks) para
 * que puedas, sin tocar código ni la Shell de Render:
 *
 *  1. Ver tus categorías/subcategorías REALES (traídas en vivo de
 *     Tiendanube, no una copia vieja) y asignarles un "grupo de
 *     mayoreo" (varias categorías pueden compartir el mismo grupo,
 *     como Pulseras Infantil + Adulto).
 *  2. Definir la tabla de precios por cantidad de cada grupo.
 *  3. Forzar una resincronización manual de productos si hace falta
 *     (normalmente no hace falta, porque los webhooks de productos
 *     lo hacen solo).
 *
 * Protegido con usuario/contraseña básica (variables de entorno
 * ADMIN_USER / ADMIN_PASSWORD). Si no las configurás, usa valores
 * por defecto SOLO para desarrollo — cambialos antes de producción.
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
} = require("./db");

const router = express.Router();
const API_VERSION = "2025-03";
const { APP_USER_AGENT } = process.env;
const TIER_ROWS = 6; // cantidad de filas editables por tabla de precio

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
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 1.1rem; margin-top: 2.5rem; border-bottom: 2px solid #eee; padding-bottom: 0.3rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
    input[type=text], input[type=number] { width: 100%; box-sizing: border-box; padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px; }
    button { background: #1a1a1a; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-top: 0.5rem; }
    button.secondary { background: #999; }
    .group-block { border: 1px solid #eee; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
    .muted { color: #777; font-size: 0.85rem; }
    .msg { background: #e6f4ea; border: 1px solid #34a853; padding: 0.6rem 1rem; border-radius: 6px; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>🏀 Mayoreo — Panel de administración</h1>
  ${body}
</body>
</html>`;
}

// --- GET /admin: página principal -----------------------------------

router.get("/admin", async (req, res) => {
  try {
    const store = await getFirstStore();
    if (!store) {
      return res.send(layout("Mayoreo Admin", "<p>Todavía no hay ninguna tienda instalada.</p>"));
    }

    const [categories, categoryGroups, tierRules] = await Promise.all([
      fetchLiveCategories(store),
      getAllCategoryGroups(),
      getAllTierRules(),
    ]);

    const nameById = {};
    for (const c of categories) nameById[c.id] = c.name?.es || c.name || c.id;

    // --- Sección 1: tabla de categorías ---
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
      <h2>1. Asignar categorías a un grupo de mayoreo</h2>
      <p class="muted">Categorías con el mismo nombre de grupo SUMAN sus cantidades (ej: escribí "pulseras" en Infantil y en Adulto). Dejá vacío si esa categoría no tiene mayoreo.</p>
      <form method="POST" action="/admin/category-groups">
        <table>
          <tr><th>Categoría</th><th>Subcategoría de</th><th>ID</th><th>Grupo de mayoreo</th></tr>
          ${categoryRows}
        </table>
        <button type="submit">Guardar asignaciones</button>
      </form>
    `;

    // --- Sección 2: tiers por grupo ---
    const allGroupKeys = [
      ...new Set([...Object.values(categoryGroups), ...Object.keys(tierRules)]),
    ].filter(Boolean);

    const groupBlocks = allGroupKeys
      .map((groupKey) => {
        const tiers = tierRules[groupKey] || [];
        // Ordenamos ascendente para que se vea natural en el formulario
        const sortedTiers = [...tiers].sort((a, b) => a.min_qty - b.min_qty);

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
          <form method="POST" action="/admin/tier-rules">
            <input type="hidden" name="group_key" value="${escapeHtml(groupKey)}">
            <h3>${escapeHtml(groupKey)}</h3>
            <table>
              <tr><th>Cantidad mínima</th><th>Precio por unidad</th></tr>
              ${rows}
            </table>
            <button type="submit">Guardar tabla de precios</button>
          </form>
          <form method="POST" action="/admin/tier-rules/delete" style="display:inline">
            <input type="hidden" name="group_key" value="${escapeHtml(groupKey)}">
            <button type="submit" class="secondary">Borrar grupo completo</button>
          </form>
        </div>`;
      })
      .join("");

    const section2 = `
      <h2>2. Tablas de precio por grupo</h2>
      <p class="muted">Dejá filas vacías si un grupo tiene menos de ${TIER_ROWS} escalones. Para crear un grupo nuevo, asignáselo primero a una categoría en la sección de arriba.</p>
      ${groupBlocks || '<p class="muted">Todavía no hay ningún grupo creado.</p>'}
    `;

    // --- Sección 3: resync manual ---
    const section3 = `
      <h2>3. Sincronización de productos</h2>
      <p class="muted">Los productos nuevos se sincronizan solos vía webhooks. Usá esto solo si sospechás que algo quedó desactualizado.</p>
      <form method="POST" action="/admin/sync-products">
        <button type="submit">Sincronizar productos ahora</button>
      </form>
    `;

    const savedMsg = req.query.saved
      ? `<div class="msg">✅ Cambios guardados.</div>`
      : "";

    res.send(layout("Mayoreo Admin", savedMsg + section1 + section2 + section3));
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

module.exports = router;
