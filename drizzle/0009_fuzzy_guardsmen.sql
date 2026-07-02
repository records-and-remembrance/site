ALTER TABLE "recording" ADD COLUMN "version_name" text;--> statement-breakpoint
ALTER TABLE "recording" ADD COLUMN "version_description" text;--> statement-breakpoint
COMMENT ON COLUMN "recording"."version_name" IS '録音バージョンの名称';--> statement-breakpoint
COMMENT ON COLUMN "recording"."version_description" IS '録音バージョンの特徴';
