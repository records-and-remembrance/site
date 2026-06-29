ALTER TABLE "work" DROP CONSTRAINT "work_type_check";--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_type_check" CHECK ("work"."type" IN ('original', 'compilation', 'best', 'live'));--> statement-breakpoint
COMMENT ON COLUMN "work"."type" IS '作品種別（original: オリジナル、compilation: 複数アーティストの編集盤、best: 同一アーティストの編集盤、live: ライブ作品集）';--> statement-breakpoint
UPDATE "work"
SET "type" = 'live'
WHERE "title" IN (
	'festival M.O.N. -勝利の美学- 2015.10.24 at LIQUIDROOM ebisu',
	'festival M.O.N. -勝利の美学- 2015.10.24 at LIQUIDROOM ebisu (Live DVD)',
	'A Place, Dark & Dark -prologue- LIVE at Kenmin kyosai Mirai Hall_Jan 31, 2015',
	'Memory of the GOLDENBELLCITY',
	'Memory of the GOLDENBELLCITY (Live DVD)'
);
