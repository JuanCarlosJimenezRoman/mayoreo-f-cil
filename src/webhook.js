/**
 * webhook.js
 * -------------------------------------------------------------
 * Este endpoint es el "callback_url" que registramos en promotions.js.
 * Tiendanube lo va a llamar por POST cada vez que un cliente modifique
 * el carrito (agregue producto, cambie cantidad, etc.), enviando todo
 * el estado del carrito.
 *
 * Reglas de negocio implementadas:
 *  1. Solo clientes REGISTRADOS (logueados) acceden al mayoreo.
 *     Lo sabemos porque `customer.id` viene null si es invitado.
 *  2. El descuento es progresivo según la cantidad total de un mismo
 *     producto en el carrito (ver tiers.js para editar los escalones).
 *  3. Respondemos con "commands" que le dicen a Tiendanube qué
 *     descuento aplicar a cada línea del carrito.
 *
 * ⏱️ OJO: Tiendanube da un timeout de 800ms para esta respuesta. Por
 * eso todo acá es cálculo en memoria, sin llamadas a APIs externas
 * ni consultas lentas a base de datos.
 *
 * Referencia:
 * https://tiendanube.github.io/api-documentation/resources/discounts
 * -------------------------------------------------------------
 */

const express = require("express");
const { getStore } = require("./db");
const { getTierForQuantity } = require("./tiers");

const router = express.Router();

router.post("/webhooks/discounts", express.json(), (req, res) => {
  const cart = req.body;

  try {
    const store = getStore(String(cart.store_id));
    const promotionId = store?.promotion_id;

    if (!promotionId) {
      // No tenemos una promoción registrada para esta tienda todavía.
      return res.status(204).send();
    }

    // Regla 1: solo clientes registrados / logueados.
    const isRegisteredCustomer = Boolean(cart.customer && cart.customer.id);
    if (!isRegisteredCustomer) {
      return res.status(204).send();
    }

    // Regla 2: agrupamos cantidades por product_id.
    // AGRUPACIÓN: si preferís que el mayoreo cuente por variante (SKU)
    // individual en vez de por producto, cambiá la clave del Map de
    // `product.product_id` a `product.variant_id`.
    const qtyByProduct = new Map();
    for (const product of cart.products || []) {
      const key = product.product_id;
      qtyByProduct.set(key, (qtyByProduct.get(key) || 0) + product.quantity);
    }

    const lineItemsWithDiscount = [];

    for (const product of cart.products || []) {
      const totalQtyOfThisProduct = qtyByProduct.get(product.product_id);
      const tier = getTierForQuantity(totalQtyOfThisProduct);

      if (!tier) continue; // no llega al mínimo de ningún escalón

      const unitPrice = parseFloat(product.price);
      const lineSubtotal = unitPrice * product.quantity;
      const discountAmount = (lineSubtotal * tier.discountPercent) / 100;

      lineItemsWithDiscount.push({
        line_item: String(product.id),
        discount_specs: {
          type: "fixed",
          amount: discountAmount.toFixed(2),
        },
      });
    }

    if (lineItemsWithDiscount.length === 0) {
      // Ningún producto llega al mínimo de mayoreo: nos aseguramos de
      // quitar cualquier descuento previo que hubiera quedado aplicado
      // (por ejemplo, si el cliente bajó la cantidad).
      return res.json({
        commands: [
          {
            command: "remove_discount",
            specs: { scope: "cart", promotion_ids: [promotionId] },
          },
        ],
      });
    }

    return res.json({
      commands: [
        {
          command: "create_or_update_discount",
          specs: {
            promotion_id: promotionId,
            currency: cart.currency,
            display_text: { "es-mx": "Descuento por mayoreo" },
            line_items: lineItemsWithDiscount,
          },
        },
      ],
    });
  } catch (err) {
    console.error("Error procesando webhook de carrito:", err);
    // Ante cualquier error, no mandamos comandos inválidos: Tiendanube
    // ya de por sí borra todo si la respuesta es inválida, así que
    // preferimos responder 204 (sin cambios) y loguear el error.
    return res.status(204).send();
  }
});

module.exports = router;
