CREATE TABLE "article" (
	"id" uuid PRIMARY KEY NOT NULL,
	"publication_issue_id" uuid,
	"title" text NOT NULL,
	"type" text,
	"published_date" date,
	"summary" text,
	"content" text,
	"url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "article_mention_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"mention_type" text NOT NULL,
	"notes" text,
	CONSTRAINT "article_mention_event_unique" UNIQUE("article_id","event_id","mention_type")
);

CREATE TABLE "article_mention_person" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"mention_type" text NOT NULL,
	"notes" text,
	CONSTRAINT "article_mention_person_unique" UNIQUE("article_id","person_id","mention_type")
);

CREATE TABLE "article_mention_work" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"mention_type" text NOT NULL,
	"notes" text,
	CONSTRAINT "article_mention_work_unique" UNIQUE("article_id","work_id","mention_type")
);

CREATE TABLE "composition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	CONSTRAINT "composition_title_unique" UNIQUE("title")
);

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

CREATE TABLE "contribution" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"instrument_id" uuid,
	"recording_id" uuid,
	"release_id" uuid,
	"event_id" uuid,
	"notes" text,
	CONSTRAINT "contribution_single_target_check" CHECK ((("contribution"."recording_id" IS NOT NULL)::int + ("contribution"."release_id" IS NOT NULL)::int + ("contribution"."event_id" IS NOT NULL)::int) = 1)
);

CREATE TABLE "distributor" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "distributor_name_unique" UNIQUE("name")
);

CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"type" text DEFAULT 'live' NOT NULL,
	"event_name" text,
	"event_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"doors_open_time" time,
	"ticket_price" integer,
	"description" text,
	"notes" text,
	CONSTRAINT "event_project_venue_event_date_unique" UNIQUE("project_id","venue_id","event_date")
);

CREATE TABLE "event_performance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"composition_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"encore" boolean DEFAULT false NOT NULL,
	"variation_note" text,
	"notes" text,
	CONSTRAINT "event_performance_event_order_index_unique" UNIQUE("event_id","order_index"),
	CONSTRAINT "event_performance_order_index_check" CHECK ("event_performance"."order_index" > 0)
);

CREATE TABLE "instrument" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "instrument_name_unique" UNIQUE("name")
);

CREATE TABLE "label" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "label_name_unique" UNIQUE("name")
);

CREATE TABLE "label_relation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"release_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "label_relation_release_label_unique" UNIQUE("release_id","label_id")
);

CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date,
	"from_date_precision" text,
	"to_date_precision" text,
	"support" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "membership_person_project_from_date_unique" UNIQUE("person_id","project_id","from_date"),
	CONSTRAINT "membership_to_date_check" CHECK ("membership"."to_date" IS NULL OR "membership"."to_date" >= "membership"."from_date")
);

CREATE TABLE "membership_role" (
	"id" uuid PRIMARY KEY NOT NULL,
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"instrument_id" uuid,
	CONSTRAINT "membership_role_unique" UNIQUE("membership_id","role_id","instrument_id")
);

CREATE TABLE "person" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"birth_date" date,
	"death_date" date,
	"active_from" date,
	"active_to" date,
	CONSTRAINT "person_name_unique" UNIQUE("name")
);

CREATE TABLE "project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"start_date" date,
	"end_date" date,
	CONSTRAINT "project_name_unique" UNIQUE("name"),
	CONSTRAINT "project_end_date_check" CHECK ("project"."end_date" IS NULL OR "project"."end_date" >= "project"."start_date")
);

CREATE TABLE "publication" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"publisher" text,
	"description" text,
	CONSTRAINT "publication_name_unique" UNIQUE("name")
);

CREATE TABLE "publication_issue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"publication_id" uuid NOT NULL,
	"issue_number" text,
	"volume" text,
	"published_date" date,
	"description" text
);

CREATE TABLE "recording" (
	"id" uuid PRIMARY KEY NOT NULL,
	"composition_id" uuid NOT NULL,
	"version_name" text,
	"version_description" text,
	"recording_year" integer,
	"type" text DEFAULT 'studio' NOT NULL,
	"recorded_date" date,
	"recorded_from" date,
	"recorded_to" date,
	"release_date" date,
	"notes" text,
	CONSTRAINT "recording_recorded_to_check" CHECK ("recording"."recorded_to" IS NULL OR "recording"."recorded_to" >= "recording"."recorded_from"),
	CONSTRAINT "recording_type_check" CHECK ("recording"."type" IN ('studio', 'live', 'demo', 'rehearsal', 'other'))
);

CREATE TABLE "recording_review" (
	"composition_id" uuid PRIMARY KEY NOT NULL,
	"assignment_fingerprint" text NOT NULL,
	"reviewed_at" timestamp NOT NULL
);

CREATE TABLE "release" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"format" text NOT NULL,
	"catalog_number" text,
	"release_date" date,
	"release_date_precision" text,
	"recorded_from" date,
	"recorded_to" date,
	"description" text,
	"notes" text,
	"distributor_id" uuid,
	"edition_type" text DEFAULT 'original' NOT NULL,
	"reissue_of_release_id" uuid,
	CONSTRAINT "release_work_format_release_date_unique" UNIQUE("work_id","format","release_date"),
	CONSTRAINT "release_recorded_to_check" CHECK ("release"."recorded_to" IS NULL OR "release"."recorded_to" >= "release"."recorded_from"),
	CONSTRAINT "release_edition_type_check" CHECK ("release"."edition_type" IN ('original', 'reissue')),
	CONSTRAINT "release_reissue_source_check" CHECK ("release"."reissue_of_release_id" IS NULL OR "release"."reissue_of_release_id" <> "release"."id")
);

CREATE TABLE "role" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);

CREATE TABLE "track" (
	"id" uuid PRIMARY KEY NOT NULL,
	"release_id" uuid NOT NULL,
	"recording_id" uuid NOT NULL,
	"track_number" integer NOT NULL,
	"recorded_date" date,
	"notes" text,
	CONSTRAINT "track_release_track_number_unique" UNIQUE("release_id","track_number"),
	CONSTRAINT "track_track_number_check" CHECK ("track"."track_number" > 0)
);

CREATE TABLE "venue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"description" text,
	CONSTRAINT "venue_name_location_unique" UNIQUE("name","location")
);

CREATE TABLE "work" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_date" date,
	"released_date" date,
	"type" text DEFAULT 'original' NOT NULL,
	CONSTRAINT "work_project_title_unique" UNIQUE("project_id","title"),
	CONSTRAINT "work_type_check" CHECK ("work"."type" IN ('original', 'compilation', 'best', 'live'))
);

CREATE TABLE "work_project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"relation_type" text DEFAULT 'primary' NOT NULL,
	CONSTRAINT "work_project_work_project_unique" UNIQUE("work_id","project_id"),
	CONSTRAINT "work_project_relation_type_check" CHECK ("work_project"."relation_type" IN ('primary', 'participant'))
);

ALTER TABLE "article" ADD CONSTRAINT "article_publication_issue_id_publication_issue_id_fk" FOREIGN KEY ("publication_issue_id") REFERENCES "public"."publication_issue"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "article_mention_event" ADD CONSTRAINT "article_mention_event_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "article_mention_event" ADD CONSTRAINT "article_mention_event_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "article_mention_person" ADD CONSTRAINT "article_mention_person_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "article_mention_person" ADD CONSTRAINT "article_mention_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "article_mention_work" ADD CONSTRAINT "article_mention_work_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "article_mention_work" ADD CONSTRAINT "article_mention_work_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "composition_credit" ADD CONSTRAINT "composition_credit_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "composition_credit" ADD CONSTRAINT "composition_credit_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_instrument_id_instrument_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_recording_id_recording_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recording"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "contribution" ADD CONSTRAINT "contribution_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event" ADD CONSTRAINT "event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event" ADD CONSTRAINT "event_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "event_performance" ADD CONSTRAINT "event_performance_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_performance" ADD CONSTRAINT "event_performance_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "label_relation" ADD CONSTRAINT "label_relation_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "label_relation" ADD CONSTRAINT "label_relation_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "membership" ADD CONSTRAINT "membership_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "membership" ADD CONSTRAINT "membership_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "membership_role" ADD CONSTRAINT "membership_role_membership_id_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."membership"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "membership_role" ADD CONSTRAINT "membership_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "membership_role" ADD CONSTRAINT "membership_role_instrument_id_instrument_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "publication_issue" ADD CONSTRAINT "publication_issue_publication_id_publication_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publication"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "recording" ADD CONSTRAINT "recording_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "recording_review" ADD CONSTRAINT "recording_review_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "release" ADD CONSTRAINT "release_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "release" ADD CONSTRAINT "release_distributor_id_distributor_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributor"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "release" ADD CONSTRAINT "release_reissue_of_release_id_release_id_fk" FOREIGN KEY ("reissue_of_release_id") REFERENCES "public"."release"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "track" ADD CONSTRAINT "track_release_id_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."release"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "track" ADD CONSTRAINT "track_recording_id_recording_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recording"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "work" ADD CONSTRAINT "work_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "work_project" ADD CONSTRAINT "work_project_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "work_project" ADD CONSTRAINT "work_project_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
