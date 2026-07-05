CREATE TABLE "composition_credit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"composition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"credit_type" text NOT NULL,
	"order_index" integer NOT NULL,
	CONSTRAINT "composition_credit_person_type_unique" UNIQUE("composition_id","person_id","credit_type"),
	CONSTRAINT "composition_credit_order_unique" UNIQUE("composition_id","credit_type","order_index"),
	CONSTRAINT "composition_credit_type_check" CHECK ("composition_credit"."credit_type" IN ('composer', 'lyricist')),
	CONSTRAINT "composition_credit_order_index_check" CHECK ("composition_credit"."order_index" > 0)
);
--> statement-breakpoint
ALTER TABLE "composition_credit" ADD CONSTRAINT "composition_credit_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_credit" ADD CONSTRAINT "composition_credit_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
COMMENT ON TABLE "composition_credit" IS '楽曲の作曲者・作詞者クレジット';--> statement-breakpoint
COMMENT ON COLUMN "composition_credit"."credit_type" IS 'クレジット種別（composer / lyricist）';--> statement-breakpoint
COMMENT ON COLUMN "composition_credit"."order_index" IS '同じ種別内での表示順';
