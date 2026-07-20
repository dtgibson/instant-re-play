CREATE TABLE "play_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"play_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "play_actors_play_id_name_key" UNIQUE("play_id","name"),
	CONSTRAINT "play_actors_play_id_position_key" UNIQUE("play_id","position"),
	CONSTRAINT "play_actors_name_not_blank" CHECK (btrim("play_actors"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"date_seen" date,
	"venue" text,
	"director" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plays_name_not_blank" CHECK (btrim("plays"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "play_actors" ADD CONSTRAINT "play_actors_play_id_plays_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."plays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "play_actors_name_idx" ON "play_actors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "plays_date_seen_idx" ON "plays" USING btree ("date_seen" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "plays_venue_idx" ON "plays" USING btree ("venue");--> statement-breakpoint
CREATE INDEX "plays_director_idx" ON "plays" USING btree ("director");