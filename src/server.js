require("dotenv").config();
const express = require("express");
const { initDb } = require("./db");
const authRouter = require("./auth");
const webhookRouter = require("./webhook");
const productWebhookRouter = require("./productWebhook");
const adminRouter = require("./admin");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Mayoreo App para BASKATBALL 23 — corriendo correctamente ✅");
});

app.use(authRouter);
app.use(webhookRouter);
app.use(productWebhookRouter);
app.use(adminRouter);

async function start() {
  await initDb(); // crea la tabla 'stores' en Postgres si no existe
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
}

start().catch((err) => {
  console.error("No se pudo iniciar el servidor:", err);
  process.exit(1);
});
