# Implementation TODO

DB tables and raw data categories that exist but are not fully covered by seed-generation scripts.

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Done

## High Priority

- [x] Decide `media` / `article` ingestion policy.
  - Classify the 12 files in `rawData/articles_by_category/media/`.
  - Decide how to model one-off articles, radio programs, and broadcast episode lists.
  - Reconfirm responsibilities for `publication`, `publication_issue`, and `article`.

- [x] Add `scripts/generate_media_seed_sql.ts`.
  - Generate `publication`.
  - Generate `publication_issue`.
  - Generate `article`.
  - Start without `article_mention_*` rows so media source files can be represented in DB first.

- [x] Design `article_mention_*` generation rules.
  - Cover `article_mention_work`.
  - Cover `article_mention_event`.
  - Cover `article_mention_person`.
  - Decide whether to trust Markdown links, tags, known title/person matching, or a review-draft flow.
  - Initial policy: use deterministic internal links and explicit release/person evidence only; use review drafts for broader matching.

- [~] Decide `contribution` ingestion policy.
  - Cover release credits.
  - Cover recording credits.
  - Cover live/event support members.
  - Define how staff, producer, guest performer, lyricist, composer, and arranger credits should map to `role` / `instrument`.
  - Initial investigation found release `## クレジット`, track performer matrices, and Live `サポートメンバー` as the primary sources.

- [~] Add `scripts/generate_contribution_seed_sql.ts`.
  - Generate `person_id`.
  - Generate `role_id`.
  - Generate optional `instrument_id`.
  - Set exactly one of `recording_id`, `release_id`, or `event_id`.
  - Preserve `source_file=...` in `notes`.
  - Current implementation covers Live `サポートメンバー` -> `event_id`; release and recording credits remain.

## Medium Priority

- [~] Introduce Drizzle as the typed DB layer.
  - Add `app/db/schema.ts` mirroring `database.sql`.
  - Add `drizzle.config.ts`.
  - Add generated initial Drizzle migrations under `drizzle/`.
  - Keep `database.sql` as bootstrap source until migration ownership is explicitly moved.
  - Decide later whether seed generators should emit SQL files, execute through Drizzle, or support both.

- [ ] Expand `role` / `instrument` vocabulary for contributions.
  - Add or normalize roles such as `producer`, `arranger`, `composer`, `lyricist`, `guest`, and `staff`.
  - Add a Japanese-to-English normalization table where source data uses Japanese labels.

- [ ] Decide how to use `rawData/articles_by_category/label/`.
  - Review the 4 label source files.
  - Decide whether `label.description` should be populated from a dedicated label generator.
  - Keep release-derived label creation working.

- [ ] Decide how to use `rawData/articles_by_category/event/`.
  - Review the 2 non-Live event files.
  - Decide whether existing `event` is sufficient for exhibitions and related events.
  - Consider whether `event.type` or another discriminator is needed.

- [ ] Decide how to use `rawData/articles_by_category/lyrics/`.
  - Review the 23 lyrics files.
  - Decide whether lyrics belong in `composition.description` or a new table.
  - Confirm copyright/storage policy before importing full lyric text.

## Quality Checks

- [ ] Add article/media quality checks.
  - Find media source files not represented in DB.
  - Find articles without publication or issue where one should exist.
  - Find unresolved or suspicious article mentions.

- [ ] Add contribution quality checks.
  - Find contributions with missing or suspicious roles.
  - Find contributions with missing instruments where expected.
  - Check that every contribution has exactly one target; this should also be enforced by the DB constraint.

## Documentation

- [~] Update `README.md`.
  - Add new seed-generation commands.
  - Update import order.
  - Document any review step required for media or contribution data.

- [x] Update `guides/project-overview-for-agents.md`.
  - Add new flow sections once generators exist.
  - Keep the currently supported table list accurate.

- [~] Update `guides/data-structure.md`.
  - Replace future-use notes after media/article ingestion is implemented.
  - Replace future-use notes after contribution ingestion is implemented.
  - Document any new tables or columns if schema changes are needed.

## Current Table Coverage Snapshot

Tables with schema but no seed-generation script as of this TODO:

- `article_mention_work`
- `article_mention_event`
- `article_mention_person`

Tables already covered by at least one script:

- `person`
- `project`
- `membership`
- `role`
- `instrument`
- `membership_role`
- `work`
- `distributor`
- `release`
- `label`
- `label_relation`
- `composition`
- `recording`
- `track`
- `venue`
- `event`
- `event_performance`
- `publication`
- `publication_issue`
- `article`
- `contribution`

Raw data category counts observed while creating this TODO:

- `Live`: 366
- `release`: 46
- `lyrics`: 23
- `etc.`: 13
- `media`: 12
- `biography`: 8
- `memo`: 7
- `label`: 4
- `person`: 3
- `event`: 2
