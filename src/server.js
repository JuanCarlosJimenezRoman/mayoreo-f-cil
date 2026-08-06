require("dotenv").config();
const express = require("express");
const authRouter = require("./auth");
const webhookRouter = require("./webhook");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Mayoreo App para BASKATBALL 23 — corriendo correctamente ✅");
});

app.use(authRouter);
app.use(webhookRouter);

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
