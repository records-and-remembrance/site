CREATE TABLE "recording_review" (
	"composition_id" uuid PRIMARY KEY NOT NULL,
	"assignment_fingerprint" text NOT NULL,
	"reviewed_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recording_review" ADD CONSTRAINT "recording_review_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
COMMENT ON TABLE "recording_review" IS '楽曲ごとの録音割り当てレビュー状態';
