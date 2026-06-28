ALTER TABLE "event" ADD COLUMN "type" text DEFAULT 'live' NOT NULL;
--> statement-breakpoint
COMMENT ON COLUMN "event"."type" IS 'イベント種別（live / exhibition / listening_event 等）';
