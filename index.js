// backend/index.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const sanitizeHtml = require("sanitize-html");

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_WALLET = "0x4794d0B88F5579117Ca8e7ab8FF8b5f95DbD0213".toLowerCase();
const FILE_PATH = path.join(__dirname, "data", "mensajes.json");

// Cargar mensajes previos
let messages = [];
if (fs.existsSync(FILE_PATH)) {
  try {
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    messages = JSON.parse(data);
  } catch (err) {
    console.error("Error al leer mensajes:", err);
    messages = [];
  }
}

// Guardar mensajes
function saveMessages() {
  fs.writeFileSync(FILE_PATH, JSON.stringify(messages, null, 2));
}

// ✅ Ruta para enviar mensaje con firma
app.post("/api/send-message", (req, res) => {
  const { walletAddress, message, signature } = req.body;

  if (!walletAddress || !message || !signature) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({ error: "Firma inválida" });
    }

    const sanitizedMessage = sanitizeHtml(message, {
      allowedTags: [],
      allowedAttributes: {},
    });

    const entry = {
      walletAddress,
      message: sanitizedMessage,
      timestamp: new Date(),
    };

    messages.push(entry);
    saveMessages();

    console.log("✅ Mensaje recibido de", walletAddress);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ Error verificando firma:", err);
    return res.status(400).json({ error: "Firma inválida" });
  }
});

// ✅ Ruta para ver mensajes
app.get("/api/messages", (req, res) => {
  return res.status(200).json(messages);
});

// ✅ Ruta protegida para descargar archivo
app.post("/api/admin/messages-file", (req, res) => {
  const { signature } = req.body;
  const authMessage = "Soy el administrador de la dApp";

  if (!signature) {
    return res.status(400).json({ error: "Falta la firma" });
  }

  try {
    const recovered = ethers.utils.verifyMessage(authMessage, signature);
    if (recovered.toLowerCase() !== ADMIN_WALLET) {
      return res.status(403).json({ error: "No autorizado" });
    }

    return res.download(FILE_PATH, "mensajes.json");

  } catch (err) {
    console.error("❌ Error de autorización:", err);
    return res.status(400).json({ error: "Firma inválida" });
  }
});

app.listen(3001, () => {
  console.log("🚀 Backend corriendo en http://localhost:3001");
});
