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

// 🧠 API Key laden mit optionalem Fallback (für lokale Tests)
const openaiApiKey = process.env.OPENAI_API_KEY || "sk-FAKE_KEY_NUR_FALLBACK";
if (!openaiApiKey || openaiApiKey.includes("FAKE_KEY")) {
  console.warn("❌ OPENAI_API_KEY fehlt! Bitte in Railway unter 'Variables' eintragen.");
} else {
  console.log("✅ OPENAI_API_KEY geladen.");
}

const openai = new OpenAI({ apiKey: openaiApiKey });

app.use(cors());
app.use(express.static("public"));

app.post("/api/edit", (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).send("Fehler beim Parsen des Formulars");

    const color = fields.color?.[0];
    const image = files.image?.[0];

    if (!color || !image?.path) {
      return res.status(400).send("Bild oder Farbe fehlen");
    }

    const convertedPath = image.path + "_rgba.png";

    try {
      // 🧼 Bild vorbereiten
      await sharp(image.path)
        .resize({ width: 512 }) // kleiner = schneller
        .ensureAlpha()
        .png()
        .toFile(convertedPath);

      // 🖌️ Prompt loggen für Debugging
      const prompt = `Ändere explizit die Wandfarbe des Hauses im Bild zu ${color}. Lasse alle anderen Bildinhalte unverändert.`;
      console.log("🧠 Prompt an OpenAI:", prompt);

      // 🔥 Bild an OpenAI schicken
      const response = await openai.images.edit({
        image: fs.createReadStream(convertedPath),
        mask: fs.createReadStream(convertedPath),
        prompt: prompt,
        n: 1,
        size: "1024x1024"
      });

      // 📤 KI-Bild zurück an Frontend
      const imageUrl = response.data?.[0]?.url;
      if (imageUrl) {
        res.status(200).json({ image: imageUrl });
      } else {
        console.error("❌ Keine Bild-URL zurückgegeben:", response);
        res.status(500).send("OpenAI hat kein Bild zurückgegeben");
      }

    } catch (error) {
      console.error("🔥 Fehler beim OpenAI-Call:", error);
      res.status(500).send("Fehler bei der Bildbearbeitung");
    } finally {
      // 🧹 Temporäre Dateien löschen
      fs.unlinkSync(image.path);
      fs.unlinkSync(convertedPath);
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Server läuft auf Port ${port}`);
});
