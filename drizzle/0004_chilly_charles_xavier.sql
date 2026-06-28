ALTER TABLE "membership" ADD COLUMN "support" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "membership"
SET
  "support" = true,
  "note" = NULLIF(regexp_replace("note", '^support;\s*', ''), '')
WHERE "note" LIKE 'support;%';
--> statement-breakpoint
COMMENT ON COLUMN "membership"."support" IS 'サポートメンバーかどうか';
