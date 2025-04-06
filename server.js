import express from "express";
import dotenv from "dotenv";
import multiparty from "multiparty";
import fs from "fs";
import sharp from "sharp";
import { OpenAI } from "openai";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 👉 Lade API-Key aus Umgebungsvariablen ODER zur Not aus Fallback (nur debug!)
const openaiApiKey = process.env.OPENAI_API_KEY || "sk-...DEIN_BACKUP_KEY_HIER_EINTRAGEN";
if (!openaiApiKey || openaiApiKey.startsWith("sk-...")) {
  console.warn("❌ OPENAI_API_KEY fehlt! Trage ihn in Railway unter Variables ein.");
} else {
  console.log("✅ OPENAI_API_KEY geladen.");
}

const openai = new OpenAI({ apiKey: openaiApiKey });

app.use(cors());
app.use(express.static("public"));

app.post("/api/edit", (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).send("Form error");

    const color = fields.color?.[0];
    const image = files.image?.[0];

    if (!color || !image?.path) {
      return res.status(400).send("Missing image or color");
    }

    const convertedPath = image.path + "_rgba.png";

    try {
      await sharp(image.path)
        .resize({ width: 512 })
        .ensureAlpha()
        .png()
        .toFile(convertedPath);

      const response = await openai.images.edit({
        image: fs.createReadStream(convertedPath),
        mask: fs.createReadStream(convertedPath),
        prompt: `Ändere die Wandfarbe des Hauses in ${color}`,
        n: 1,
        size: "1024x1024",
      });

      res.status(200).json({ image: response.data[0].url });
    } catch (error) {
      console.error("🔥 Fehler bei OpenAI-Aufruf:", error);
      res.status(500).send("Image edit failed");
    } finally {
      fs.unlinkSync(image.path);
      fs.unlinkSync(convertedPath);
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Server läuft auf Port ${port}`);
});
