// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  thai: text("thai").notNull(),
  chinese: text("chinese").notNull(),
  pronunciation: text("pronunciation").notNull(),
  example: text("example").notNull(),
  example_translation: text("example_translation").notNull(),
  level: integer("level").notNull().default(1),
  // 1-4 for 基础泰语1-4
  // Audio and image file paths
  word_audio: text("word_audio"),
  // Path to word audio file
  example_audio: text("example_audio"),
  // Path to example audio file
  card_image: text("card_image")
  // Path to generated card image
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var insertCardSchema = createInsertSchema(cards).pick({
  thai: true,
  chinese: true,
  pronunciation: true,
  example: true,
  example_translation: true,
  level: true
});
var cardFileSchema = z.object({
  cards: z.array(z.object({
    id: z.number().optional(),
    // Will be ignored during import
    thai: z.string(),
    chinese: z.string(),
    pronunciation: z.string(),
    example: z.string(),
    example_translation: z.string(),
    level: z.number().min(1).max(4).default(1)
  }))
});

// server/storage.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import path from "path";
var SqliteStorage = class {
  db;
  constructor() {
    const sqlite = new Database(path.join(process.cwd(), "database.sqlite"));
    this.db = drizzle(sqlite);
    this.initializeTables();
    this.initializeSampleCards();
  }
  initializeTables() {
    const sqlite = this.db.$client;
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thai TEXT NOT NULL,
        chinese TEXT NOT NULL,
        pronunciation TEXT NOT NULL,
        example TEXT NOT NULL,
        example_translation TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        word_audio TEXT,
        example_audio TEXT,
        card_image TEXT
      );
    `);
  }
  async initializeSampleCards() {
    const existingCards = await this.getAllCards();
    if (existingCards.length > 0) {
      return;
    }
    const sampleCards = [
      {
        thai: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35",
        chinese: "\u4F60\u597D",
        pronunciation: "s\xE0-w\xE0t-dii",
        example: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E04\u0E23\u0E31\u0E1A \u0E1C\u0E21\u0E0A\u0E37\u0E48\u0E2D\u0E08\u0E2D\u0E2B\u0E4C\u0E19",
        example_translation: "\u4F60\u597D\uFF0C\u6211\u53EB\u7EA6\u7FF0",
        level: 1
      },
      {
        thai: "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13",
        chinese: "\u8C22\u8C22",
        pronunciation: "k\u0254\u0300\u0254p-kun",
        example: "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E21\u0E32\u0E01\u0E04\u0E23\u0E31\u0E1A",
        example_translation: "\u975E\u5E38\u611F\u8C22",
        level: 1
      }
    ];
    await this.bulkCreateCards(sampleCards);
  }
  async getUser(id) {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }
  async getUserByUsername(username) {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }
  async createUser(user) {
    const result = await this.db.insert(users).values(user).returning();
    return result[0];
  }
  async getAllCards() {
    return await this.db.select().from(cards);
  }
  async getCardsByLevel(level) {
    return await this.db.select().from(cards).where(eq(cards.level, level));
  }
  async createCard(card) {
    const { id, ...cardWithoutId } = card;
    const result = await this.db.insert(cards).values(cardWithoutId).returning();
    return result[0];
  }
  async getCardById(id) {
    const result = await this.db.select().from(cards).where(eq(cards.id, id)).limit(1);
    return result[0] || null;
  }
  async updateCard(id, updateData) {
    const result = await this.db.update(cards).set(updateData).where(eq(cards.id, id)).returning();
    return result[0];
  }
  async deleteCard(id) {
    await this.db.delete(cards).where(eq(cards.id, id));
  }
  async clearCards() {
    await this.db.delete(cards);
  }
  async clearCardsByLevel(level) {
    await this.db.delete(cards).where(eq(cards.level, level));
  }
  async bulkCreateCards(cardList) {
    if (cardList.length === 0) return [];
    const results = [];
    for (const card of cardList) {
      const result = await this.createCard(card);
      results.push(result);
    }
    return results;
  }
};
var storage = new SqliteStorage();

// server/routes.ts
import multer from "multer";
import { z as z2 } from "zod";
import fs from "fs/promises";
import path2 from "path";
var upload = multer({ storage: multer.memoryStorage() });
async function registerRoutes(app2) {
  app2.get("/api/audio/generated/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const audioPath = path2.join(process.cwd(), "generated", "audio", filename);
      const exists = await fs.access(audioPath).then(() => true).catch(() => false);
      if (!exists) {
        return res.status(404).json({ error: "Generated audio file not found" });
      }
      res.setHeader("Content-Type", "audio/mpeg");
      const fileStream = await fs.readFile(audioPath);
      res.send(fileStream);
    } catch (error) {
      console.error("Generated audio serve error:", error);
      res.status(500).json({ error: "Failed to serve generated audio" });
    }
  });
  app2.get("/api/cards", async (req, res) => {
    try {
      const { level, random, limit } = req.query;
      let cards2;
      if (level) {
        const levelNum = parseInt(level, 10);
        if (isNaN(levelNum) || levelNum < 1 || levelNum > 4) {
          return res.status(400).json({ error: "Invalid level. Must be between 1 and 4." });
        }
        cards2 = await storage.getCardsByLevel(levelNum);
      } else {
        cards2 = await storage.getAllCards();
      }
      if (random === "true" && cards2.length > 0) {
        const shuffled = [...cards2];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const maxCards = limit ? parseInt(limit, 10) : 10;
        cards2 = shuffled.slice(0, Math.min(maxCards, shuffled.length));
        console.log(`\u{1F3B2} Random sampling: ${cards2.length} cards selected from ${shuffled.length} total cards for level ${level}`);
      }
      res.json(cards2);
    } catch (error) {
      console.error("Get cards error:", error);
      res.status(500).json({ error: "Failed to fetch cards" });
    }
  });
  app2.post("/api/cards/upload", upload.single("file"), async (req, res) => {
    try {
      console.log("\u{1F4C1} File upload request received");
      if (!req.file) {
        console.error("\u274C No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
      }
      console.log("\u{1F4C4} File details:", {
        name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
      const fileContent = req.file.buffer.toString("utf8");
      console.log("\u{1F4D6} File content preview:", fileContent.substring(0, 200));
      const jsonData = JSON.parse(fileContent);
      console.log("\u{1F50D} JSON parsed successfully, validating...");
      const validatedData = cardFileSchema.parse(jsonData);
      console.log("\u2705 JSON validation passed, creating cards...");
      const cardsToCreate = validatedData.cards.map((card) => {
        const { id, ...cardWithoutId } = card;
        return cardWithoutId;
      });
      const createdCards = await storage.bulkCreateCards(cardsToCreate);
      console.log(`\u{1F3AF} Created ${createdCards.length} cards successfully`);
      const allCards = await storage.getAllCards();
      res.json({
        message: "Cards uploaded successfully",
        count: createdCards.length,
        total: allCards.length,
        cards: createdCards
      });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        console.error("\u274C JSON validation error:", error.errors);
        res.status(400).json({ error: "Invalid JSON format", details: error.errors });
      } else {
        console.error("\u274C File upload error:", error);
        res.status(500).json({ error: "Failed to process file", details: String(error) });
      }
    }
  });
  app2.get("/api/cards/sample", (req, res) => {
    const sampleData = {
      cards: [
        {
          id: 1,
          thai: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35",
          chinese: "\u4F60\u597D",
          pronunciation: "s\xE0-w\xE0t-dii",
          example: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E04\u0E23\u0E31\u0E1A \u0E1C\u0E21\u0E0A\u0E37\u0E48\u0E2D\u0E08\u0E2D\u0E2B\u0E4C\u0E19",
          example_translation: "\u4F60\u597D\uFF0C\u6211\u53EB\u7EA6\u7FF0"
        },
        {
          id: 2,
          thai: "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13",
          chinese: "\u8C22\u8C22",
          pronunciation: "k\u0254\u0300\u0254p-kun",
          example: "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E21\u0E32\u0E01\u0E04\u0E23\u0E31\u0E1A",
          example_translation: "\u975E\u5E38\u611F\u8C22"
        }
      ]
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", 'attachment; filename="thai_sample.json"');
    res.json(sampleData);
  });
  app2.delete("/api/cards/clear", async (req, res) => {
    try {
      await storage.clearCards();
      res.json({ message: "All cards cleared successfully" });
    } catch (error) {
      console.error("Clear cards error:", error);
      res.status(500).json({ error: "Failed to clear cards" });
    }
  });
  app2.delete("/api/cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const cardId = parseInt(id, 10);
      if (isNaN(cardId)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      await storage.deleteCard(cardId);
      res.json({ message: "Card deleted successfully" });
    } catch (error) {
      console.error("Delete card error:", error);
      res.status(500).json({ error: "Failed to delete card" });
    }
  });
  app2.post("/api/audio/generate", async (req, res) => {
    try {
      const { text: text2, language = "th-TH" } = req.body;
      if (!text2) {
        return res.status(400).json({ error: "Text is required" });
      }
      const voiceCode = language === "th" ? "th-TH" : language;
      const response = await fetch("https://api.soundoftext.com/sounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          engine: "Google",
          data: {
            text: text2,
            voice: voiceCode
          }
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }
      const result = await response.json();
      res.json({ success: result.success, id: result.id });
    } catch (error) {
      console.error("Audio generation error:", error);
      res.status(500).json({ error: "Failed to generate audio", details: error.message });
    }
  });
  app2.get("/api/audio/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const response = await fetch(`https://api.soundoftext.com/sounds/${id}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`SoundOfText status API error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to get audio status: ${response.status}`);
      }
      const result = await response.json();
      res.json(result);
    } catch (error) {
      console.error("Audio status error:", error);
      res.status(500).json({ error: "Failed to get audio status", details: error.message });
    }
  });
  app2.get("/api/audio/download/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const statusResponse = await fetch(`https://api.soundoftext.com/sounds/${id}`);
      if (!statusResponse.ok) {
        throw new Error("Failed to get audio status");
      }
      const status = await statusResponse.json();
      if (status.status !== "Done" || !status.location) {
        return res.status(404).json({ error: "Audio not ready or not found" });
      }
      const audioResponse = await fetch(status.location);
      if (!audioResponse.ok) {
        throw new Error("Failed to download audio file");
      }
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${id}.mp3"`);
      const audioBuffer = await audioResponse.arrayBuffer();
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Audio download error:", error);
      res.status(500).json({ error: "Failed to download audio file" });
    }
  });
  app2.delete("/api/cards/:id", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      if (isNaN(cardId)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      await storage.deleteCard(cardId);
      res.json({
        message: "Card deleted successfully"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete card" });
    }
  });
  app2.delete("/api/cards/clear", async (req, res) => {
    try {
      await storage.clearCards();
      res.json({
        message: "All cards cleared successfully"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cards" });
    }
  });
  app2.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime()
    });
  });
  app2.post("/api/cards/generate", async (req, res) => {
    try {
      const { cardIds } = req.body;
      if (!cardIds || !Array.isArray(cardIds)) {
        return res.status(400).json({ error: "Card IDs array is required" });
      }
      const results = [];
      for (const cardId of cardIds) {
        const card = await storage.getCardById(cardId);
        if (!card) {
          results.push({ cardId, success: false, error: "Card not found" });
          continue;
        }
        try {
          const wordAudioPath = await generateAudio(card.thai, `word_${cardId}_${Date.now()}.mp3`);
          const exampleAudioPath = await generateAudio(card.example, `example_${cardId}_${Date.now()}.mp3`);
          const cardImagePath = await generateCardImage(card, `card_${cardId}_${Date.now()}.svg`);
          await storage.updateCard(cardId, {
            word_audio: wordAudioPath,
            example_audio: exampleAudioPath,
            card_image: cardImagePath
          });
          results.push({
            cardId,
            success: true,
            wordAudio: wordAudioPath,
            exampleAudio: exampleAudioPath,
            cardImage: cardImagePath
          });
        } catch (error) {
          console.error(`Error generating files for card ${cardId}:`, error);
          results.push({ cardId, success: false, error: String(error) });
        }
      }
      res.json({ success: true, results });
    } catch (error) {
      console.error("Error in card generation:", error);
      res.status(500).json({ error: "Failed to generate card files" });
    }
  });
  app2.get("/api/audio/generated/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const audioPath = path2.join(process.cwd(), "generated", "audio", filename);
      const exists = await fs.access(audioPath).then(() => true).catch(() => false);
      if (!exists) {
        return res.status(404).json({ error: "Audio file not found" });
      }
      if (filename.endsWith(".json")) {
        res.setHeader("Content-Type", "application/json");
      } else {
        res.setHeader("Content-Type", "audio/mpeg");
      }
      const fileStream = await fs.readFile(audioPath);
      res.send(fileStream);
    } catch (error) {
      console.error("Error serving audio file:", error);
      res.status(500).json({ error: "Failed to serve audio file" });
    }
  });
  app2.get("/api/images/generated/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const imagePath = path2.join(process.cwd(), "generated", "images", filename);
      const exists = await fs.access(imagePath).then(() => true).catch(() => false);
      if (!exists) {
        return res.status(404).json({ error: "Image file not found" });
      }
      res.setHeader("Content-Type", "image/svg+xml");
      const fileStream = await fs.readFile(imagePath);
      res.send(fileStream);
    } catch (error) {
      console.error("Error serving image file:", error);
      res.status(500).json({ error: "Failed to serve image file" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
async function generateAudio(text2, filename) {
  try {
    const audioDir = path2.join(process.cwd(), "generated", "audio");
    await fs.mkdir(audioDir, { recursive: true });
    console.log(`\u{1F3B5} Generating audio for: ${text2}`);
    const metadataContent = JSON.stringify({
      text: text2,
      language: "th-TH",
      timestamp: Date.now(),
      useClientTTS: true
    });
    const filePath = path2.join(audioDir, filename.replace(".mp3", ".json"));
    await fs.writeFile(filePath, metadataContent);
    console.log(`\u2705 Created TTS metadata: ${filename.replace(".mp3", ".json")}`);
    return `generated/audio/${filename.replace(".mp3", ".json")}`;
  } catch (error) {
    console.error("Error generating audio metadata:", error);
    throw error;
  }
}
async function generateCardImage(card, filename) {
  try {
    const imageDir = path2.join(process.cwd(), "generated", "images");
    await fs.mkdir(imageDir, { recursive: true });
    const svgContent = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .thai-text { font-family: 'Sarabun', 'Noto Sans Thai', Arial, sans-serif; }
            .main-text { font-size: 64px; font-weight: bold; fill: #1f2937; text-anchor: middle; }
            .pronunciation { font-size: 24px; font-style: italic; fill: #6b7280; text-anchor: middle; }
            .chinese-text { font-size: 36px; font-weight: bold; fill: #1f2937; text-anchor: middle; }
            .example-bg { fill: #fef3c7; stroke: #f59e0b; stroke-width: 4; }
            .example-title { font-size: 20px; font-weight: bold; fill: #92400e; }
            .example-text { font-size: 28px; font-weight: bold; fill: #78350f; text-anchor: middle; }
            .example-translation { font-size: 24px; fill: #92400e; text-anchor: middle; }
          </style>
        </defs>
        
        <!-- Background -->
        <rect width="800" height="600" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
        
        <!-- Thai word -->
        <text x="400" y="150" class="thai-text main-text">${card.thai}</text>
        
        <!-- Pronunciation -->
        <text x="400" y="190" class="pronunciation">${card.pronunciation}</text>
        
        <!-- Divider -->
        <line x1="100" y1="220" x2="700" y2="220" stroke="#d1d5db" stroke-width="1"/>
        
        <!-- Chinese translation -->
        <text x="400" y="280" class="chinese-text">${card.chinese}</text>
        
        <!-- Example section background -->
        <rect x="60" y="320" width="680" height="220" class="example-bg"/>
        
        <!-- Example label -->
        <text x="80" y="350" class="example-title">\u4F8B\u53E5 Example:</text>
        
        <!-- Example text -->
        <text x="400" y="390" class="thai-text example-text">${card.example}</text>
        
        <!-- Example translation -->
        <text x="400" y="450" class="example-translation">${card.example_translation}</text>
      </svg>
    `;
    const svgFilename = filename.replace(".png", ".svg");
    const filePath = path2.join(imageDir, svgFilename);
    await fs.writeFile(filePath, svgContent);
    return `generated/images/${svgFilename}`;
  } catch (error) {
    console.error("Error generating card image:", error);
    throw error;
  }
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path4 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path3 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var currentDir = process.cwd();
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path3.resolve(currentDir, "client", "src"),
      "@shared": path3.resolve(currentDir, "shared"),
      "@assets": path3.resolve(currentDir, "attached_assets")
    }
  },
  root: path3.resolve(currentDir, "client"),
  build: {
    outDir: path3.resolve(currentDir, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";
var viteLogger = createLogger();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path4.dirname(__filename);
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path4.resolve(
        process.cwd(),
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const dist = path4.resolve(process.cwd(), "dist");
  app2.use(express.static(dist));
  app2.use("*", (_req, res) => {
    res.sendFile(path4.resolve(dist, "public", "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path5 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path5.startsWith("/api")) {
      let logLine = `${req.method} ${path5} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5e3;
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
