# Mayoreo App — BASKATBALL 23

App privada para tu tienda Tiendanube que aplica **descuentos progresivos por
cantidad** (mayoreo), visibles automáticamente en el carrito, **solo para
clientes registrados/logueados**.

Por defecto viene configurado así (editable en `src/tiers.js`):

| Cantidad del mismo producto | Descuento |
|---|---|
| 10 o más unidades | 10% |
| 20 o más unidades | 15% |
| 50 o más unidades | 20% |

---

## 1. Registrate como Partner/Socio de Tiendanube

1. Andá a https://www.tiendanube.com/partners (o https://www.nuvemshop.com.br/parceiros)
   y creá tu cuenta de socio/desarrollador (es gratis).
2. Dentro del panel de socio, entrá a **"Apps"** y creá una nueva app.
   - Tipo: app privada (para uso exclusivo de tu propia tienda) o pública, según
     te lo permita el panel — para un solo comercio alcanza con privada.
   - **Redirect URL / URL de redirección**: `https://TU-DOMINIO/auth/callback`
   - **Scopes**: como mínimo necesitás `read_products`, `read_orders` (y los que
     pida la Discount API para promociones).
3. Guardá el `Client ID` y `Client Secret` que te da — van en tu `.env`.
4. Buscá la sección de **Discount API / Webhooks de promociones** dentro de tu
   app y revisá el `openapi.yml` que linkean ahí (ver nota en `src/promotions.js`
   sobre por qué es importante confirmar el formato exacto antes de producción).

## 2. Conseguí dónde alojar el servidor

Como charlamos, no hace falta nada muy grande. Este servidor es liviano
(Node.js + Express) y solo necesita:
- Estar siempre encendido (para responder los webhooks de carrito en <800ms).
- Tener HTTPS (obligatorio, Tiendanube no llama a URLs sin SSL).

Opciones económicas para arrancar:
- **Railway** o **Render**: planes desde ~USD 5-7/mes, deploy con un `git push`, HTTPS automático. Los más simples para empezar.
- **Un VPS chico** (DigitalOcean, Hetzner, Contabo): desde ~USD 4-6/mes, requiere que configures Node + Nginx/Certbot vos mismo (más control, más trabajo).
- **Fly.io / Vercel** (funciones serverless): puede tener capa gratuita, pero para webhooks con estado (guardar tokens) conviene un server "always-on" simple como Railway/Render.

Para arrancar y probar rápido, te recomiendo Railway o Render.

## 3. Configurar el proyecto

```bash
npm install
cp .env.example .env
# completá CLIENT_ID, CLIENT_SECRET, APP_URL y DATABASE_URL con tus datos reales
npm start
```

### Base de datos: PostgreSQL

Este proyecto ya viene armado para usar PostgreSQL (ver `src/db.js`). En Render:

1. New > PostgreSQL > plan Free.
2. Copiá el "Internal Database URL" (si tu Web Service vive en el mismo
   proyecto de Render) y pegalo en la variable `DATABASE_URL` de tu Web
   Service (sección Environment).
3. Al arrancar, el servidor crea solo la tabla `stores` (no hace falta que
   corras ninguna migración a mano).

### ¿Ya tenés un access_token de la pantalla de prueba del panel de socios?

Si generaste el código curl de prueba (5 min de validez) y ya sacaste tu
`access_token` y `user_id`, no hace falta esperar a que el flujo OAuth por
navegador esté funcionando: podés registrar la promoción a mano con:

```bash
# 1. Editá scripts/test-manual.js y pegá ahí tu ACCESS_TOKEN y STORE_ID
# 2. Corré:
node scripts/test-manual.js
```

Esto te va a dejar la tienda lista en la base para poder probar el webhook
de `/webhooks/discounts` de una.

## 4. Instalar la app en tu tienda

Una vez tengas el server corriendo en tu dominio público, andá a:

```
https://www.tiendanube.com/apps/{TU_APP_ID}/authorize
```

(reemplazá `{TU_APP_ID}` por el ID que te dio el panel de socios). Vas a ver la
pantalla de autorización de tu propia tienda BASKATBALL 23; al aceptar, la app
se instala, se guarda el token, y se registra automáticamente la promoción de
mayoreo (todo eso lo hace `src/auth.js`).

## 5. Probar

1. Entrá a tu tienda con una cuenta de cliente registrada (logueate).
2. Agregá 10+ unidades de un mismo producto al carrito.
3. El descuento debería reflejarse en el carrito automáticamente. Si no lo ves,
   revisá los logs de tu servidor — ahí vas a ver cada request que llega a
   `/webhooks/discounts` y cualquier error.
4. Probá también como invitado (sin loguearte): NO debería aplicar descuento.

## 6. Qué archivo tocar para cada cosa

| Querés cambiar... | Archivo |
|---|---|
| Los escalones de cantidad/porcentaje | `src/tiers.js` |
| Si el mayoreo agrupa por producto o por variante (SKU/talle) | `src/webhook.js` (comentario "AGRUPACIÓN") |
| El texto que ve el cliente en el carrito | `src/webhook.js` (`display_text`) |
| Cómo se registra la promoción | `src/promotions.js` |

## 7. Mayoreo por categoría con precio fijo (pulseras, calcetas, etc.)

El sistema ahora soporta un modelo más flexible: en vez de "% de descuento
según cantidad de un producto", podés definir **tablas de precio por
unidad según la cantidad total comprada dentro de una categoría** (o grupo
de categorías). Ejemplo real que armamos:

- **Pulseras** (infantil + adulto, sumadas): 50+ piezas → $35 c/u, 100+ → $30 c/u
- **Calcetas Unicornio**: 10+ piezas → $200 c/u
- **Calcetas Elite**: 10+ piezas → $150 c/u, 15+ piezas → $135 c/u

### Cómo cargar esto en tu tienda

```bash
# 1. Ver los IDs reales de tus categorías/subcategorías
ACCESS_TOKEN=xxx STORE_ID=xxx node scripts/sync-categories.js

# 2. Editar scripts/seed-tier-rules.js con esos IDs y tus precios reales

# 3. Cargar la configuración en la base de datos
node scripts/seed-tier-rules.js

# 4. Sincronizar qué categoría tiene cada producto
ACCESS_TOKEN=xxx STORE_ID=xxx node scripts/sync-products.js
```

### Importante: esto es una sincronización manual (por ahora)

Los scripts 1 y 4 traen una "foto" de tus categorías y productos en ese
momento. Si después agregás productos nuevos o les cambiás la categoría
en el admin de Tiendanube, **hay que volver a correr `sync-products.js`**
para que el mayoreo los detecte correctamente.

La forma correcta de automatizar esto a futuro es suscribirse a los
webhooks de `product/created`, `product/updated` y `product/deleted` de
Tiendanube (no confundir con el webhook de descuentos que ya tenemos) —
queda pendiente como mejora, avisame cuando quieras que lo armemos.

### Nota sobre `src/tiers.js`

El archivo `src/tiers.js` (con los escalones por % que usábamos antes) ya
**no lo usa** `webhook.js` — quedó como referencia por si en el futuro
querés combinar ambos modelos (% para unos productos, precio fijo para
otros). Si no lo vas a usar, lo podés borrar sin problema.

## 8. Panel de administración (dashboard)

Entrá a `https://tu-servidor.onrender.com/admin` con el usuario y contraseña
que definiste en `ADMIN_USER` / `ADMIN_PASSWORD`. Desde ahí podés, sin tocar
código ni la Shell de Render:

1. **Ver tus categorías reales** (traídas en vivo de Tiendanube) y asignarles
   un "grupo de mayoreo" — categorías con el mismo nombre de grupo suman sus
   cantidades entre sí (ej: Pulseras Infantil + Adulto).
2. **Editar la tabla de precios** de cada grupo (cantidad mínima → precio por
   unidad).
3. **Forzar una resincronización manual** de productos si sospechás que algo
   quedó desactualizado (normalmente no hace falta, ver siguiente sección).

⚠️ El usuario/contraseña por defecto (`admin` / `cambiame`) es solo para que
no se rompa si te olvidás de configurarlo — **cambialo** en las variables de
entorno de Render antes de usarlo en serio.

## 9. Sincronización automática de productos nuevos

Para que no tengas que correr `sync-products.js` cada vez que agregás un
producto, la app se suscribe a los webhooks de Tiendanube de
`product/created`, `product/updated` y `product/deleted`. Correlo **una sola
vez**, después de que tu servidor esté desplegado con la URL final:

```bash
ACCESS_TOKEN=xxx STORE_ID=xxx node scripts/register-product-webhooks.js
```

A partir de ahí, cualquier producto que crees, edites o borres en Tiendanube
va a actualizar sola la tabla `product_categories` de tu base — no hace falta
que hagas nada más. El botón "Sincronizar productos ahora" del dashboard
queda como respaldo manual por si algún webhook se pierde.

## 10. Multi-tienda y magic link

La app ahora soporta **múltiples tiendas instaladas al mismo tiempo**, cada
una con sus propias categorías, grupos y tablas de precio — completamente
aisladas entre sí.

### Cómo entra cada comercio a su dashboard

Ya no hay usuario/contraseña compartido. Al instalar la app (flujo OAuth
real), se genera automáticamente un **magic link único** por tienda, y el
comerciante es redirigido ahí mismo. Ese link (`/admin?token=...`) es su
credencial — no necesita recordar nada, y queda guardado en una cookie del
navegador para no tener que repetirlo en cada visita.

### Si una tienda ya estaba instalada antes de este cambio

No tiene magic link generado todavía. Generalo con:

```bash
STORE_ID=8057813 node scripts/generate-admin-link.js
```

(sin `STORE_ID`, usa la última tienda instalada)

### Scripts de un solo comercio (sync-categories, seed-tier-rules, etc.)

Siguen funcionando igual, pero ahora hay que indicarles a qué tienda
corresponden si tenés más de una instalada:

```bash
STORE_ID=8057813 node scripts/sync-categories.js
STORE_ID=8057813 node scripts/sync-products.js
STORE_ID=8057813 node scripts/seed-tier-rules.js
STORE_ID=8057813 node scripts/register-product-webhooks.js
```

Si solo tenés una tienda instalada, podés omitir `STORE_ID` y va a usar esa
automáticamente.

## 11. Landing page, prueba gratis, y plan pago

### Landing page

`https://tu-servidor.onrender.com/` ahora muestra una página pública
explicando la app (para cuando la enlaces desde la Tienda de Aplicaciones,
o para mostrarle a comerciantes interesados mientras tanto). Editá el
precio y el email de contacto en `.env`:

```
SUPPORT_EMAIL=tu-email@ejemplo.com
PRICE_MONTHLY=$299 MXN
```

### Prueba gratis de 15 días

Cada tienda nueva que instala la app arranca con 15 días de prueba
(`trial_ends_at` en la tabla `stores`). El dashboard le muestra un banner
con los días restantes. Al vencer, **el dashboard se bloquea** (pantalla de
"tu prueba terminó") pero **los descuentos que ya configuró le siguen
funcionando en la tienda** — no le rompés las ventas por no haber pagado,
solo le impedís seguir configurando cosas nuevas.

⚠️ Las tiendas que ya estaban instaladas antes de este cambio (como
BASKATBALL 23) quedan automáticamente en plan activo — no las bloquea.

### Activar el plan pago

Todavía no hay un cobro real conectado (depende de si terminás usando el
sistema nativo de Tiendanube o "compras internas" — confirmalo en
homologación). Mientras tanto, activalo a mano:

```bash
STORE_ID=8057813 node scripts/mark-store-paid.js
```
  cupones o la regla nativa de Tiendanube, revisá que no compitan con esta app
  para el mismo producto (Tiendanube prioriza mostrar un solo cartel de
  descuento a la vez).
- **Verificación de firma**: Tiendanube va a habilitar firma de requests para
  este webhook (mencionado como "upcoming" en su doc). Cuando esté disponible,
  conviene agregarla para más seguridad.
