import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  thai: text("thai").notNull(),
  chinese: text("chinese").notNull(),
  pronunciation: text("pronunciation").notNull(),
  example: text("example").notNull(),
  example_translation: text("example_translation").notNull(),
  level: integer("level").notNull().default(1), // 1-4 for 基础泰语1-4
  // Audio and image file paths
  word_audio: text("word_audio"), // Path to word audio file
  example_audio: text("example_audio"), // Path to example audio file
  card_image: text("card_image"), // Path to generated card image
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCardSchema = createInsertSchema(cards).pick({
  thai: true,
  chinese: true,
  pronunciation: true,
  example: true,
  example_translation: true,
  level: true,
});

export const cardFileSchema = z.object({
  cards: z.array(z.object({
    id: z.number().optional(), // Will be ignored during import
    thai: z.string(),
    chinese: z.string(),
    pronunciation: z.string(),
    example: z.string(),
    example_translation: z.string(),
    level: z.number().min(1).max(4).default(1),
  }))
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type CardFile = z.infer<typeof cardFileSchema>;
