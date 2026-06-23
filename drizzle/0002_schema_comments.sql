COMMENT ON TABLE "person" IS '個人（ミュージシャン、スタッフなど）';
COMMENT ON COLUMN "person"."name" IS '表示名';
COMMENT ON COLUMN "person"."description" IS '人物の説明';
COMMENT ON COLUMN "person"."birth_date" IS '生年月日';
COMMENT ON COLUMN "person"."death_date" IS '死亡日';
COMMENT ON COLUMN "person"."active_from" IS '活動開始時期';
COMMENT ON COLUMN "person"."active_to" IS '活動終了時期';
--> statement-breakpoint
COMMENT ON TABLE "project" IS '活動単位（バンド、ソロ、ユニット）';
COMMENT ON COLUMN "project"."type" IS '活動形態（band / solo 等）';
--> statement-breakpoint
COMMENT ON TABLE "membership" IS 'プロジェクトへの参加期間';
COMMENT ON TABLE "role" IS '役割（performer, producer など）';
COMMENT ON TABLE "instrument" IS '楽器';
COMMENT ON TABLE "membership_role" IS '参加期間中の役割';
COMMENT ON TABLE "work" IS '抽象作品（アルバム単位）';
COMMENT ON TABLE "release" IS '具体リリース（CD, 配信など）';
COMMENT ON TABLE "composition" IS '楽曲（抽象）';
COMMENT ON TABLE "recording" IS '録音単位（アレンジ・バージョン）';
COMMENT ON TABLE "track" IS 'リリース内の曲順';
COMMENT ON TABLE "event" IS 'ライブ・公演';
COMMENT ON TABLE "event_performance" IS 'セットリスト';
COMMENT ON TABLE "contribution" IS '関与（誰が何にどの役割で関与したか）';
COMMENT ON TABLE "publication" IS '媒体（雑誌、ウェブサイト）';
COMMENT ON TABLE "publication_issue" IS '雑誌の号・巻';
COMMENT ON TABLE "article" IS '記事（雑誌記事・Web記事）';
