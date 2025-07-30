// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users;
  cards;
  currentUserId;
  currentCardId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.cards = /* @__PURE__ */ new Map();
    this.currentUserId = 1;
    this.currentCardId = 1;
    this.initializeSampleCards();
  }
  initializeSampleCards() {
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
    sampleCards.forEach((card) => {
      const id = this.currentCardId++;
      const cardWithId = { ...card, id };
      this.cards.set(id, cardWithId);
    });
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.currentUserId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async getAllCards() {
    return Array.from(this.cards.values());
  }
  async getCardsByLevel(level) {
    return Array.from(this.cards.values()).filter((card) => card.level === level);
  }
  async createCard(insertCard) {
    const id = this.currentCardId++;
    const card = { ...insertCard, id };
    this.cards.set(id, card);
    return card;
  }
  async deleteCard(id) {
    this.cards.delete(id);
  }
  async clearCards() {
    this.cards.clear();
    this.currentCardId = 1;
  }
  async clearCardsByLevel(level) {
    const cardsToDelete = Array.from(this.cards.entries()).filter(([_, card]) => card.level === level).map(([id, _]) => id);
    cardsToDelete.forEach((id) => this.cards.delete(id));
  }
  async bulkCreateCards(insertCards) {
    const createdCards = [];
    for (const insertCard of insertCards) {
      const card = await this.createCard(insertCard);
      createdCards.push(card);
    }
    return createdCards;
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  thai: text("thai").notNull(),
  chinese: text("chinese").notNull(),
  pronunciation: text("pronunciation").notNull(),
  example: text("example").notNull(),
  example_translation: text("example_translation").notNull(),
  level: integer("level").notNull().default(1)
  // 1-4 for 基础泰语1-4
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
    thai: z.string(),
    chinese: z.string(),
    pronunciation: z.string(),
    example: z.string(),
    example_translation: z.string(),
    level: z.number().min(1).max(4).default(1)
  }))
});

// server/routes.ts
import multer from "multer";
import { z as z2 } from "zod";

// server/oss.ts
import OSS from "ali-oss";
var OSSService = class {
  client = null;
  config = null;
  constructor() {
    this.initializeFromEnv();
  }
  initializeFromEnv() {
    const region = process.env.OSS_REGION;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET_NAME;
    const endpoint = process.env.OSS_ENDPOINT;
    if (region && accessKeyId && accessKeySecret && bucket) {
      this.config = {
        region,
        accessKeyId,
        accessKeySecret,
        bucket,
        endpoint
      };
      this.client = new OSS({
        region: this.config.region,
        accessKeyId: this.config.accessKeyId,
        accessKeySecret: this.config.accessKeySecret,
        bucket: this.config.bucket,
        endpoint: this.config.endpoint
      });
      console.log("OSS client initialized successfully");
    } else {
      console.log("OSS configuration not found in environment variables");
    }
  }
  isConfigured() {
    return this.client !== null && this.config !== null;
  }
  async uploadCards(cards2) {
    if (!this.client || !this.config) {
      console.log("OSS not configured, skipping upload");
      return null;
    }
    try {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const filename = `thai-cards-backup-${timestamp}.json`;
      const data = {
        timestamp,
        cards: cards2,
        count: cards2.length
      };
      const result = await this.client.put(filename, Buffer.from(JSON.stringify(data, null, 2)));
      console.log(`Cards backed up to OSS: ${filename}`);
      return result.url;
    } catch (error) {
      console.error("Failed to upload cards to OSS:", error);
      return null;
    }
  }
  async downloadLatestCards() {
    if (!this.client || !this.config) {
      console.log("OSS not configured, skipping download");
      return null;
    }
    try {
      const result = await this.client.list({
        prefix: "thai-cards-backup-",
        "max-keys": 1e3
      });
      if (!result.objects || result.objects.length === 0) {
        console.log("No backup files found in OSS");
        return null;
      }
      const latestFile = result.objects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())[0];
      console.log(`Downloading latest backup: ${latestFile.name}`);
      const fileResult = await this.client.get(latestFile.name);
      const data = JSON.parse(fileResult.content.toString());
      return data.cards || [];
    } catch (error) {
      console.error("Failed to download cards from OSS:", error);
      return null;
    }
  }
  async syncCards(localCards) {
    if (!this.isConfigured()) {
      return;
    }
    try {
      await this.uploadCards(localCards);
      console.log("Cards synced to OSS successfully");
    } catch (error) {
      console.error("Failed to sync cards to OSS:", error);
    }
  }
};
var ossService = new OSSService();

// server/routes.ts
var upload = multer({ storage: multer.memoryStorage() });
async function registerRoutes(app2) {
  app2.get("/api/cards", async (req, res) => {
    try {
      const { level } = req.query;
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
      res.json(cards2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cards" });
    }
  });
  app2.post("/api/cards/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileContent = req.file.buffer.toString("utf8");
      const jsonData = JSON.parse(fileContent);
      const validatedData = cardFileSchema.parse(jsonData);
      const createdCards = await storage.bulkCreateCards(validatedData.cards);
      const allCards = await storage.getAllCards();
      await ossService.syncCards(allCards);
      res.json({
        message: "Cards uploaded successfully",
        count: createdCards.length,
        total: allCards.length,
        cards: createdCards,
        ossSynced: ossService.isConfigured()
      });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: "Invalid JSON format", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to process file" });
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
        throw new Error("Failed to get audio status");
      }
      const result = await response.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get audio status" });
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
      const remainingCards = await storage.getAllCards();
      await ossService.syncCards(remainingCards);
      res.json({
        message: "Card deleted successfully",
        ossSynced: ossService.isConfigured()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete card" });
    }
  });
  app2.delete("/api/cards/clear", async (req, res) => {
    try {
      await storage.clearCards();
      await ossService.syncCards([]);
      res.json({
        message: "All cards cleared successfully",
        ossSynced: ossService.isConfigured()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cards" });
    }
  });
  app2.get("/api/oss/status", (req, res) => {
    res.json({
      configured: ossService.isConfigured(),
      message: ossService.isConfigured() ? "OSS is configured and ready" : "OSS configuration not found. Please set environment variables: OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET_NAME"
    });
  });
  app2.post("/api/oss/restore", async (req, res) => {
    try {
      if (!ossService.isConfigured()) {
        return res.status(400).json({ error: "OSS not configured" });
      }
      const ossCards = await ossService.downloadLatestCards();
      if (!ossCards || ossCards.length === 0) {
        return res.json({
          message: "No backup found in OSS",
          restored: 0
        });
      }
      await storage.clearCards();
      const restoredCards = await storage.bulkCreateCards(ossCards);
      res.json({
        message: "Cards restored from OSS successfully",
        restored: restoredCards.length,
        cards: restoredCards
      });
    } catch (error) {
      console.error("OSS restore error:", error);
      res.status(500).json({ error: "Failed to restore cards from OSS" });
    }
  });
  app2.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime()
    });
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
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
      "@": path.resolve(currentDir, "client", "src"),
      "@shared": path.resolve(currentDir, "shared"),
      "@assets": path.resolve(currentDir, "attached_assets")
    }
  },
  root: path.resolve(currentDir, "client"),
  build: {
    outDir: path.resolve(currentDir, "dist/public"),
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
var __dirname = path2.dirname(__filename);
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
      const clientTemplate = path2.resolve(
        process.cwd(),
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
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
  const dist = path2.resolve(process.cwd(), "dist");
  app2.use(express.static(dist));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(dist, "public", "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
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
