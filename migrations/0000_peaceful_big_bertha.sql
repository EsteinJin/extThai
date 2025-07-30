CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"thai" text NOT NULL,
	"chinese" text NOT NULL,
	"pronunciation" text NOT NULL,
	"example" text NOT NULL,
	"example_translation" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"word_audio" text,
	"example_audio" text,
	"card_image" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
