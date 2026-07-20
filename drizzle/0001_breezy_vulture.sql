ALTER TABLE "plays" ADD COLUMN "playwright" text;--> statement-breakpoint
CREATE INDEX "plays_playwright_idx" ON "plays" USING btree ("playwright");