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
  console.error("❌ OPENAI_API_KEY fehlt! Bitte in Railway setzen.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiApiKey });

app.use(cors());
app.use(express.static("public"));

// Root-Route liefert index.html aus dem public-Ordner
app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.post("/api/edit", (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Formular-Fehler:", err);
      return res.status(500).send("Formular-Fehler");
    }

    const color = fields.color?.[0];
    const image = files.image?.[0];

    if (!color || !image?.path) {
      return res.status(400).send("Bild oder Farbe fehlen");
    }

    // Konvertiere das hochgeladene Bild in ein 512px breites, PNG-Bild mit Alpha-Kanal
    const convertedPath = image.path + "_rgba.png";

    try {
      await sharp(image.path)
        .resize({ width: 512 })
        .ensureAlpha()
        .png()
        .toFile(convertedPath);

      // Hier wird der Prompt definiert. Optional: Den Farbcode (color) kannst du dynamisch einbauen.
      const prompt = `Ändere die Farbe der HAUSWAND in diesem Bild zu einem saftigen Grün. Die neue Farbe soll deutlich sichtbar sein. Alle anderen Bildbereiche bleiben unverändert.`;
      console.log("🧠 Prompt an OpenAI:", prompt);

      const response = await openai.images.edit({
        image: fs.createReadStream(convertedPath),
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response.data?.[0]?.url;
      if (imageUrl) {
        res.status(200).json({ image: imageUrl });
      } else {
        res.status(500).send("OpenAI hat kein Bild zurückgegeben");
      }
    } catch (error) {
      console.error("❌ Fehler bei OpenAI:", error);
      res.status(500).send("Fehler bei der Bildbearbeitung");
    } finally {
      // Lösche temporäre Dateien, sofern sie existieren
      try {
        if (fs.existsSync(image.path)) fs.unlinkSync(image.path);
        if (fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath);
      } catch (unlinkError) {
        console.error("❌ Fehler beim Löschen temporärer Dateien:", unlinkError);
      }
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Server läuft auf http://localhost:${port}`);
});
