import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCardSchema, cardFileSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";

import axios from "axios";
import fs from "fs/promises";
import path from "path";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Serve generated audio files
  app.get("/api/audio/generated/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const audioPath = path.join(process.cwd(), "generated", "audio", filename);
      
      // Check if file exists
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
  // Get all cards or cards by level with optional random sampling
  app.get("/api/cards", async (req, res) => {
    try {
      const { level, random, limit } = req.query;
      let cards;
      
      if (level) {
        const levelNum = parseInt(level as string, 10);
        if (isNaN(levelNum) || levelNum < 1 || levelNum > 4) {
          return res.status(400).json({ error: "Invalid level. Must be between 1 and 4." });
        }
        cards = await storage.getCardsByLevel(levelNum);
      } else {
        cards = await storage.getAllCards();
      }
      
      // If random sampling is requested and we have cards
      if (random === 'true' && cards.length > 0) {
        // Fisher-Yates shuffle algorithm for true randomization
        const shuffled = [...cards];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // Limit to specified number (default 10, but return all if fewer than limit available)
        const maxCards = limit ? parseInt(limit as string, 10) : 10;
        cards = shuffled.slice(0, Math.min(maxCards, shuffled.length));
        
        console.log(`🎲 Random sampling: ${cards.length} cards selected from ${shuffled.length} total cards for level ${level}`);
      }
      
      res.json(cards);
    } catch (error) {
      console.error("Get cards error:", error);
      res.status(500).json({ error: "Failed to fetch cards" });
    }
  });

  // Upload JSON file and update cards
  app.post("/api/cards/upload", upload.single("file"), async (req: MulterRequest, res) => {
    try {
      console.log("📁 File upload request received");
      
      if (!req.file) {
        console.error("❌ No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("📄 File details:", {
        name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      const fileContent = req.file.buffer.toString("utf8");
      console.log("📖 File content preview:", fileContent.substring(0, 200));
      
      const jsonData = JSON.parse(fileContent);
      console.log("🔍 JSON parsed successfully, validating...");
      
      // Validate JSON structure
      const validatedData = cardFileSchema.parse(jsonData);
      console.log("✅ JSON validation passed, creating cards...");
      
      // Remove id fields from cards and add new cards without clearing existing ones (accumulative upload)
      const cardsToCreate = validatedData.cards.map(card => {
        const { id, ...cardWithoutId } = card;
        return cardWithoutId;
      });
      const createdCards = await storage.bulkCreateCards(cardsToCreate);
      console.log(`🎯 Created ${createdCards.length} cards successfully`);
      
      const allCards = await storage.getAllCards();
      
      res.json({ 
        message: "Cards uploaded successfully", 
        count: createdCards.length,
        total: allCards.length,
        cards: createdCards
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ JSON validation error:", error.errors);
        res.status(400).json({ error: "Invalid JSON format", details: error.errors });
      } else {
        console.error("❌ File upload error:", error);
        res.status(500).json({ error: "Failed to process file", details: String(error) });
      }
    }
  });

  // Download sample JSON file
  app.get("/api/cards/sample", (req, res) => {
    const sampleData = {
      cards: [
        {
          id: 1,
          thai: "สวัสดี",
          chinese: "你好",
          pronunciation: "sà-wàt-dii",
          example: "สวัสดีครับ ผมชื่อจอห์น",
          example_translation: "你好，我叫约翰"
        },
        {
          id: 2,
          thai: "ขอบคุณ",
          chinese: "谢谢",
          pronunciation: "kɔ̀ɔp-kun",
          example: "ขอบคุณมากครับ",
          example_translation: "非常感谢"
        }
      ]
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="thai_sample.json"');
    res.json(sampleData);
  });

  // Clear all cards (must be before :id route)
  app.delete("/api/cards/clear", async (req, res) => {
    try {
      await storage.clearCards();
      res.json({ message: "All cards cleared successfully" });
    } catch (error) {
      console.error("Clear cards error:", error);
      res.status(500).json({ error: "Failed to clear cards" });
    }
  });

  // Delete a specific card
  app.delete("/api/cards/:id", async (req, res) => {
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



  // Generate audio using soundoftext.com API
  app.post("/api/audio/generate", async (req, res) => {
    try {
      const { text, language = "th-TH" } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      // Convert language code to proper format for soundoftext API
      const voiceCode = language === "th" ? "th-TH" : language;

      // Make request to soundoftext.com API
      const response = await fetch("https://api.soundoftext.com/sounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          engine: "Google",
          data: {
            text: text,
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
    } catch (error: any) {
      console.error("Audio generation error:", error);
      res.status(500).json({ error: "Failed to generate audio", details: error.message });
    }
  });

  // Get audio file status
  app.get("/api/audio/:id", async (req, res) => {
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
    } catch (error: any) {
      console.error("Audio status error:", error);
      res.status(500).json({ error: "Failed to get audio status", details: error.message });
    }
  });

  // Proxy audio file download to bypass CORS
  app.get("/api/audio/download/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // First get the audio status to check if it's ready
      const statusResponse = await fetch(`https://api.soundoftext.com/sounds/${id}`);
      if (!statusResponse.ok) {
        throw new Error("Failed to get audio status");
      }
      
      const status = await statusResponse.json();
      if (status.status !== "Done" || !status.location) {
        return res.status(404).json({ error: "Audio not ready or not found" });
      }

      // Download the audio file
      const audioResponse = await fetch(status.location);
      if (!audioResponse.ok) {
        throw new Error("Failed to download audio file");
      }

      // Set appropriate headers
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${id}.mp3"`);
      
      // Pipe the audio data to the response
      const audioBuffer = await audioResponse.arrayBuffer();
      res.send(Buffer.from(audioBuffer));
    } catch (error: any) {
      console.error("Audio download error:", error);
      res.status(500).json({ error: "Failed to download audio file" });
    }
  });

  // Delete a single card
  app.delete("/api/cards/:id", async (req, res) => {
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

  // Clear all cards and sync to OSS
  app.delete("/api/cards/clear", async (req, res) => {
    try {
      await storage.clearCards();
      
      res.json({ 
        message: "All cards cleared successfully"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cards" });
    }
  });



  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Generate card images and audio for selected cards
  app.post("/api/cards/generate", async (req, res) => {
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
          // Generate audio files
          const wordAudioPath = await generateAudio(card.thai, `word_${cardId}_${Date.now()}.mp3`);
          const exampleAudioPath = await generateAudio(card.example, `example_${cardId}_${Date.now()}.mp3`);
          
          // Generate card image
          const cardImagePath = await generateCardImage(card, `card_${cardId}_${Date.now()}.svg`);
          
          // Update card with file paths
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

  // Serve generated audio files
  app.get("/api/audio/generated/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const audioPath = path.join(process.cwd(), "generated", "audio", filename);
      
      const exists = await fs.access(audioPath).then(() => true).catch(() => false);
      if (!exists) {
        return res.status(404).json({ error: "Audio file not found" });
      }
      
      // Check if it's a JSON metadata file or actual audio
      if (filename.endsWith('.json')) {
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

  // Serve generated card images
  app.get("/api/images/generated/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const imagePath = path.join(process.cwd(), "generated", "images", filename);
      
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

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate audio using text-to-speech API
async function generateAudio(text: string, filename: string): Promise<string> {
  try {
    // Create directories if they don't exist
    const audioDir = path.join(process.cwd(), "generated", "audio");
    await fs.mkdir(audioDir, { recursive: true });
    
    console.log(`🎵 Generating audio for: ${text}`);
    
    // Since external TTS APIs are unreliable, create a metadata file
    // that tells the frontend to use browser's Speech Synthesis API
    const metadataContent = JSON.stringify({
      text: text,
      language: "th-TH",
      timestamp: Date.now(),
      useClientTTS: true
    });
    
    const filePath = path.join(audioDir, filename.replace('.mp3', '.json'));
    await fs.writeFile(filePath, metadataContent);
    
    console.log(`✅ Created TTS metadata: ${filename.replace('.mp3', '.json')}`);
    return `generated/audio/${filename.replace('.mp3', '.json')}`;
    
  } catch (error) {
    console.error("Error generating audio metadata:", error);
    throw error;
  }
}

// Helper function to generate card image using SVG
async function generateCardImage(card: any, filename: string): Promise<string> {
  try {
    // Create directories if they don't exist
    const imageDir = path.join(process.cwd(), "generated", "images");
    await fs.mkdir(imageDir, { recursive: true });
    
    // Generate SVG content
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
        <text x="80" y="350" class="example-title">例句 Example:</text>
        
        <!-- Example text -->
        <text x="400" y="390" class="thai-text example-text">${card.example}</text>
        
        <!-- Example translation -->
        <text x="400" y="450" class="example-translation">${card.example_translation}</text>
      </svg>
    `;
    
    // Save SVG file (we'll convert to PNG later if needed)
    const svgFilename = filename.replace('.png', '.svg');
    const filePath = path.join(imageDir, svgFilename);
    await fs.writeFile(filePath, svgContent);
    
    return `generated/images/${svgFilename}`;
    
  } catch (error) {
    console.error("Error generating card image:", error);
    throw error;
  }
}
