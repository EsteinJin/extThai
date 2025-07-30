import { users, cards, type User, type InsertUser, type Card, type InsertCard } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import path from "path";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Card operations
  getAllCards(): Promise<Card[]>;
  getCardsByLevel(level: number): Promise<Card[]>;
  createCard(card: InsertCard): Promise<Card>;
  getCardById(id: number): Promise<Card | null>;
  updateCard(id: number, updateData: Partial<Card>): Promise<Card>;
  deleteCard(id: number): Promise<void>;
  clearCards(): Promise<void>;
  clearCardsByLevel(level: number): Promise<void>;
  bulkCreateCards(cards: InsertCard[]): Promise<Card[]>;
}

export class SqliteStorage implements IStorage {
  private db;

  constructor() {
    // Initialize SQLite database
    const sqlite = new Database(path.join(process.cwd(), "database.sqlite"));
    this.db = drizzle(sqlite);
    
    // Create tables if they don't exist
    this.initializeTables();
    
    // Add sample data if tables are empty
    this.initializeSampleCards();
  }

  private initializeTables() {
    // Create tables using raw SQL for initial setup
    const sqlite = (this.db as any).$client;
    
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
    // Check if cards already exist
    const existingCards = await this.getAllCards();
    if (existingCards.length > 0) {
      return; // Don't add sample data if cards already exist
    }

    const sampleCards = [
      {
        thai: "สวัสดี",
        chinese: "你好",
        pronunciation: "sà-wàt-dii",
        example: "สวัสดีครับ ผมชื่อจอห์น",
        example_translation: "你好，我叫约翰",
        level: 1
      },
      {
        thai: "ขอบคุณ",
        chinese: "谢谢",
        pronunciation: "kɔ̀ɔp-kun",
        example: "ขอบคุณมากครับ",
        example_translation: "非常感谢",
        level: 1
      }
    ];

    await this.bulkCreateCards(sampleCards);
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(user).returning();
    return result[0];
  }

  async getAllCards(): Promise<Card[]> {
    return await this.db.select().from(cards);
  }

  async getCardsByLevel(level: number): Promise<Card[]> {
    return await this.db.select().from(cards).where(eq(cards.level, level));
  }

  async createCard(card: InsertCard): Promise<Card> {
    // Remove id from card if it exists (let SQLite auto-generate)
    const { id, ...cardWithoutId } = card as any;
    const result = await this.db.insert(cards).values(cardWithoutId).returning();
    return result[0];
  }

  async getCardById(id: number): Promise<Card | null> {
    const result = await this.db.select().from(cards).where(eq(cards.id, id)).limit(1);
    return result[0] || null;
  }

  async updateCard(id: number, updateData: Partial<Card>): Promise<Card> {
    const result = await this.db.update(cards).set(updateData).where(eq(cards.id, id)).returning();
    return result[0];
  }

  async deleteCard(id: number): Promise<void> {
    await this.db.delete(cards).where(eq(cards.id, id));
  }

  async clearCards(): Promise<void> {
    await this.db.delete(cards);
  }

  async clearCardsByLevel(level: number): Promise<void> {
    await this.db.delete(cards).where(eq(cards.level, level));
  }

  async bulkCreateCards(cardList: InsertCard[]): Promise<Card[]> {
    if (cardList.length === 0) return [];
    
    const results: Card[] = [];
    for (const card of cardList) {
      const result = await this.createCard(card);
      results.push(result);
    }
    return results;
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private cards: Map<number, Card>;
  private currentUserId: number;
  private currentCardId: number;

  constructor() {
    this.users = new Map();
    this.cards = new Map();
    this.currentUserId = 1;
    this.currentCardId = 1;
    
    // Initialize with sample data
    this.initializeSampleCards();
  }

  private initializeSampleCards() {
    const sampleCards = [
      {
        thai: "สวัสดี",
        chinese: "你好",
        pronunciation: "sà-wàt-dii",
        example: "สวัสดีครับ ผมชื่อจอห์น",
        example_translation: "你好，我叫约翰",
        level: 1
      },
      {
        thai: "ขอบคุณ",
        chinese: "谢谢",
        pronunciation: "kɔ̀ɔp-kun",
        example: "ขอบคุณมากครับ",
        example_translation: "非常感谢",
        level: 1
      }
    ];

    sampleCards.forEach(card => {
      const id = this.currentCardId++;
      const cardWithId: Card = { 
        ...card, 
        id,
        word_audio: null,
        example_audio: null,
        card_image: null
      };
      this.cards.set(id, cardWithId);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllCards(): Promise<Card[]> {
    return Array.from(this.cards.values());
  }

  async getCardsByLevel(level: number): Promise<Card[]> {
    return Array.from(this.cards.values()).filter(card => card.level === level);
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const id = this.currentCardId++;
    const card: Card = { 
      ...insertCard, 
      id,
      level: insertCard.level || 1,
      word_audio: null,
      example_audio: null,
      card_image: null
    };
    this.cards.set(id, card);
    return card;
  }

  async getCardById(id: number): Promise<Card | null> {
    return this.cards.get(id) || null;
  }

  async updateCard(id: number, updateData: Partial<Card>): Promise<Card> {
    const existingCard = this.cards.get(id);
    if (!existingCard) {
      throw new Error(`Card with id ${id} not found`);
    }
    const updatedCard = { ...existingCard, ...updateData };
    this.cards.set(id, updatedCard);
    return updatedCard;
  }

  async deleteCard(id: number): Promise<void> {
    this.cards.delete(id);
  }

  async clearCards(): Promise<void> {
    this.cards.clear();
    this.currentCardId = 1;
  }

  async clearCardsByLevel(level: number): Promise<void> {
    const cardsToDelete = Array.from(this.cards.entries())
      .filter(([_, card]) => card.level === level)
      .map(([id, _]) => id);
    
    cardsToDelete.forEach(id => this.cards.delete(id));
  }

  async bulkCreateCards(insertCards: InsertCard[]): Promise<Card[]> {
    const createdCards: Card[] = [];
    for (const insertCard of insertCards) {
      const card = await this.createCard(insertCard);
      createdCards.push(card);
    }
    return createdCards;
  }
}

// Use SQLite storage instead of memory storage for persistence and no external costs
export const storage = new SqliteStorage();
