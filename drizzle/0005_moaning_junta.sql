CREATE TABLE "work_project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"relation_type" text DEFAULT 'primary' NOT NULL,
	CONSTRAINT "work_project_work_project_unique" UNIQUE("work_id","project_id"),
	CONSTRAINT "work_project_relation_type_check" CHECK ("work_project"."relation_type" IN ('primary', 'participant'))
);
--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "edition_type" text DEFAULT 'original' NOT NULL;--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "reissue_of_release_id" uuid;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "type" text DEFAULT 'original' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_project" ADD CONSTRAINT "work_project_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project" ADD CONSTRAINT "work_project_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_reissue_of_release_id_release_id_fk" FOREIGN KEY ("reissue_of_release_id") REFERENCES "public"."release"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_edition_type_check" CHECK ("release"."edition_type" IN ('original', 'reissue'));--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_reissue_source_check" CHECK ("release"."reissue_of_release_id" IS NULL OR "release"."reissue_of_release_id" <> "release"."id");--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_type_check" CHECK ("work"."type" IN ('original', 'compilation', 'best'));--> statement-breakpoint
UPDATE "work" w
SET "type" = 'compilation'
WHERE EXISTS (
	SELECT 1
	FROM "release" r
	WHERE r."work_id" = w."id"
	  AND (
		r."notes" LIKE '%source_tags=%Compilation%'
		OR r."notes" LIKE 'source_file=rawData/articles/band_%'
	  )
);--> statement-breakpoint
UPDATE "work"
SET "type" = 'best'
WHERE "type" = 'original'
  AND (upper("title") = 'BEST' OR "description" LIKE '%ベスト盤%');--> statement-breakpoint
UPDATE "work" w
SET "type" = 'best'
WHERE w."type" = 'compilation'
  AND EXISTS (
	SELECT 1
	FROM "release" r
	WHERE r."work_id" = w."id"
	  AND r."notes" LIKE '%source_tags=%Reissue/Remaster%'
  );--> statement-breakpoint
UPDATE "release"
SET "edition_type" = 'reissue'
WHERE "notes" LIKE '%source_tags=%Reissue/Remaster%';--> statement-breakpoint
INSERT INTO "work_project" ("id", "work_id", "project_id", "relation_type")
SELECT
	md5('work_project:' || w."id"::text || ':' || w."project_id"::text)::uuid,
	w."id",
	w."project_id",
	CASE WHEN w."type" = 'compilation' THEN 'participant' ELSE 'primary' END
FROM "work" w
ON CONFLICT ("work_id", "project_id") DO NOTHING;--> statement-breakpoint
COMMENT ON COLUMN "work"."type" IS '作品種別（original: オリジナル、compilation: 複数アーティストの編集盤、best: 同一アーティストの編集盤）';--> statement-breakpoint
COMMENT ON TABLE "work_project" IS '作品と主名義・参加アーティストの関連';--> statement-breakpoint
COMMENT ON COLUMN "work_project"."relation_type" IS '作品との関係（primary: 主名義、participant: 参加アーティスト）';--> statement-breakpoint
COMMENT ON COLUMN "release"."edition_type" IS '版種別（original: 初版、reissue: 再発売）';--> statement-breakpoint
COMMENT ON COLUMN "release"."reissue_of_release_id" IS 'リイシュー元のリリース';
