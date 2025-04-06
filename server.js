import express from "express";
import dotenv from "dotenv";
import multiparty from "multiparty";
import fs from "fs";
import sharp from "sharp";
import { OpenAI } from "openai";
import cors from "cors";
import path from "path";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.error("❌ OPENAI_API_KEY fehlt! Bitte in Railway als Variable setzen.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiApiKey });

app.use(cors());
app.use(express.static("public")); // wichtig für index.html

// Root Weiterleitung auf index.html (nur als Fallback)
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

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
      await sharp(image.path)
        .resize({ width: 512 })
        .ensureAlpha()
        .png()
        .toFile(convertedPath);

      const prompt = `Ändere die Wandfarbe des Hauses im Bild zu ${color}. Lasse den Rest des Bildes unverändert.`;
      console.log("📤 Prompt:", prompt);

      const response = await openai.images.edit({
        image: fs.createReadStream(convertedPath),
        mask: fs.createReadStream(convertedPath),
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response.data?.[0]?.url;
      if (imageUrl) {
        res.status(200).json({ image: imageUrl });
      } else {
        res.status(500).send("OpenAI hat kein Bild zurückgegeben.");
      }

    } catch (error) {
      console.error("Fehler beim Bearbeiten:", error);
      res.status(500).send("Fehler beim Bearbeiten");
    } finally {
      fs.unlinkSync(image.path);
      fs.unlinkSync(convertedPath);
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Server läuft auf http://localhost:${port}`);
});
