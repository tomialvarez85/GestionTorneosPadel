const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server escuchando en puerto", PORT);
});
