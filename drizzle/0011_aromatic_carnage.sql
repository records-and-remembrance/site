ALTER TABLE "composition" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "scope" text DEFAULT 'monden' NOT NULL;--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "artwork_url" text;--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "artwork_width" integer;--> statement-breakpoint
ALTER TABLE "release" ADD COLUMN "artwork_height" integer;--> statement-breakpoint
ALTER TABLE "venue" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "composition" ADD CONSTRAINT "composition_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "venue" ADD CONSTRAINT "venue_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_scope_check" CHECK ("project"."scope" IN ('monden', 'external'));