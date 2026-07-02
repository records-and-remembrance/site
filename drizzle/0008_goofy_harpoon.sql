UPDATE "recording"
SET "type" = 'studio'
WHERE "type" IS NULL
	OR "type" NOT IN ('studio', 'live', 'demo', 'rehearsal', 'other');--> statement-breakpoint
ALTER TABLE "recording" ALTER COLUMN "type" SET DEFAULT 'studio';--> statement-breakpoint
ALTER TABLE "recording" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recording" ADD CONSTRAINT "recording_type_check" CHECK ("recording"."type" IN ('studio', 'live', 'demo', 'rehearsal', 'other'));
