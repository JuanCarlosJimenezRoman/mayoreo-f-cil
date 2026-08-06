/**
 * tiers.js
 * -------------------------------------------------------------
 * Acá definís tus escalones de mayoreo. Cada tier tiene:
 *  - minQty: cantidad mínima (de un mismo producto en el carrito)
 *            para que aplique ese descuento.
 *  - discountPercent: porcentaje de descuento a aplicar.
 *
 * El sistema recorre los tiers de mayor a menor y usa el primero
 * que la cantidad del carrito cumpla. Podés agregar, quitar o
 * modificar tiers libremente; no hace falta tocar el resto del código.
 *
 * IMPORTANTE: por default, la cantidad se calcula SUMANDO todas las
 * unidades de un mismo product_id en el carrito (por ejemplo, si un
 * cliente lleva 5 unidades talle S + 10 talle M del mismo producto,
 * cuenta como 15). Si preferís que el mayoreo sea por variante
 * (SKU) individual, cambiá la agrupación en webhook.js (está señalado
 * con un comentario "AGRUPACIÓN").
 * -------------------------------------------------------------
 */

const TIERS = [
  { minQty: 50, discountPercent: 20 },
  { minQty: 20, discountPercent: 15 },
  { minQty: 10, discountPercent: 10 },
];

// Ordena de mayor a menor por las dudas de que lo edites y quede desordenado
const SORTED_TIERS = [...TIERS].sort((a, b) => b.minQty - a.minQty);

/**
 * Devuelve el tier que corresponde a una cantidad dada, o null si
 * la cantidad no alcanza el mínimo del tier más bajo.
 */
function getTierForQuantity(quantity) {
  for (const tier of SORTED_TIERS) {
    if (quantity >= tier.minQty) return tier;
  }
  return null;
}

module.exports = { TIERS: SORTED_TIERS, getTierForQuantity };
