CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "membership"
ADD CONSTRAINT "membership_no_overlap"
EXCLUDE USING gist (
  "person_id" WITH =,
  "project_id" WITH =,
  daterange("from_date", COALESCE("to_date", 'infinity'::date), '[]') WITH &&
);
