import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend running" });
});

// ejemplo
app.get("/api/test", (req, res) => {
  res.json({ message: "API funcionando" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server escuchando en puerto ${PORT}`);
});
