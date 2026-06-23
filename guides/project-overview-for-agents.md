# Project Overview For Agents

This repository builds a structured PostgreSQL database from Markdown source data about Monden Masaaki-related projects, releases, live events, compositions, people, and memberships.

## Purpose

The main goal is to convert semi-structured Markdown files under `rawData/articles_by_category/` into normalized relational data defined by `database.sql`.

The current pipeline is intentionally incremental:

1. Split and inspect raw Markdown by category.
2. Generate review drafts where human judgment is required.
3. Generate SQL seed files from reviewed or mechanically parsed data.
4. Import generated SQL into the Docker Compose PostgreSQL database.
5. Run overview and quality-check SQL to find bad mappings.

## Important Directories

- `rawData/articles_by_category/`
  Source Markdown files grouped by first tag.

- `drafts/compositions/`
  Human-reviewed composition canonicalization drafts.
  Only `status: reviewed` should be used for canonical `composition` rows.

- `scripts/`
  Bun TypeScript scripts that generate SQL or review drafts.

- `sql/`
  Generated SQL and local inspection SQL.
  This directory is ignored by git via `sql/*`.

- `app/`
  Hono review UI for composition drafts.

- `guides/`
  Human/agent-facing guidance documents.

## Core Schema

Defined in `database.sql`.

Main entities currently used:

- `project`
- `person`
- `membership`
- `role`
- `instrument`
- `work`
- `release`
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

## Current Seed Generation Flow

### Release / Work

Generate release/work/project data:

```bash
bun run scripts/generate_rawdata_seed_sql.ts \
  --source-dir rawData/articles_by_category/release \
  --types release \
  --output sql/release_seed.sql
```

### Composition

Composition canonicalization is human-reviewed in Markdown first.

Generate reviewed compositions:

```bash
bun run scripts/generate_composition_seed_sql.ts \
  --output sql/composition_seed.sql
```

Only `drafts/compositions/*.md` with `status: reviewed` are emitted.

### Recording / Track

Generate release track data using reviewed composition drafts:

```bash
bun run scripts/generate_work_seed_sql.ts \
  --source-dir rawData/articles_by_category/release \
  --composition-draft-dir drafts/compositions \
  --output sql/release_tracks_seed.sql
```

### Live / Event

Generate live event data:

```bash
bun run scripts/generate_rawdata_seed_sql.ts \
  --source-dir rawData/articles_by_category/Live \
  --types live \
  --output sql/live_seed.sql
```

Generate setlist data:

```bash
bun run scripts/generate_live_performance_seed_sql.ts \
  --source-dir rawData/articles_by_category/Live \
  --composition-draft-dir drafts/compositions \
  --output sql/live_performances_seed.sql
```

### People / Membership

Generate people and membership data:

```bash
bun run scripts/generate_people_seed_sql.ts \
  --person-dir rawData/articles_by_category/person \
  --biography-dir rawData/articles_by_category/biography \
  --output sql/people_seed.sql
```

### Media / Article

Generate media/article data:

```bash
bun run scripts/generate_media_seed_sql.ts \
  --source-dir rawData/articles_by_category/media \
  --output sql/media_seed.sql
```

This represents each media Markdown source file as one `article` row, with `publication` as the durable program/index container and `publication_issue` as the broadcast date, publication date, or synthetic index issue. `article_mention_*` rows are intentionally not generated yet.

### Contribution

Generate live support contribution data:

```bash
bun run scripts/generate_contribution_seed_sql.ts \
  --live-dir rawData/articles_by_category/Live \
  --output sql/contribution_seed.sql
```

Current scope is `Live` support members only. The script emits `person`, `role`, `instrument`, and `contribution` rows, with every generated contribution targeting exactly one `event_id`.

## Import Order

Use this order for a populated local DB:

```bash
docker compose exec -T postgres psql -U monden -d monden < sql/release_seed.sql
docker compose exec -T postgres psql -U monden -d monden < sql/composition_seed.sql
docker compose exec -T postgres psql -U monden -d monden < sql/release_tracks_seed.sql
docker compose exec -T postgres psql -U monden -d monden < sql/live_seed.sql
docker compose exec -T postgres psql -U monden -d monden < sql/live_performances_seed.sql
docker compose exec -T postgres psql -U monden -d monden < sql/people_seed.sql
docker compose exec -T postgres psql -U monden -d monden < sql/contribution_seed.sql
docker compose exec -T postgres psql -U monden -d monden < sql/media_seed.sql
```

## Review UI

Start the composition review UI:

```bash
bun run review:compositions
```

Open:

```text
http://localhost:3000
```

The UI edits `drafts/compositions/*.md` directly.

## Quality / Overview SQL

Useful generated/local SQL files:

- `sql/release_overview.sql`
- `sql/event_overview.sql`
- `sql/project_overview.sql`
- `sql/people_overview.sql`
- `sql/quality_checks.sql`
- `sql/project_quality_checks.sql`

Run examples:

```bash
docker compose exec -T postgres psql -U monden -d monden < sql/project_quality_checks.sql
docker compose exec -T postgres psql -U monden -d monden < sql/project_overview.sql
```

## Important Data Rules

### Tags Are Not Always Project Names

The first tag is the broad category.

Examples:

- `Release`
- `Live`
- `参加バンド`
- `人物`

Later tags may be metadata and must not be blindly treated as project names.

Known non-project tags:

- `予定`
- `単独ライブ`
- `_incomplete`
- `Album`
- `Mini-Al`
- `Sg`
- `DVD`
- `memo`

`generate_rawdata_seed_sql.ts` has explicit filtering for these.

### Release Index Pages Are Not Releases

`rawData/articles_by_category/release/2022-12-18-000000.md` is `公開されたデモ音源リスト`.
It is a list/index page, not a release/work/project entity, and is skipped by release seed generation.

### Composition Is Human-Reviewed

Do not directly generate final `composition` rows from raw titles unless explicitly intended as fallback.
Use reviewed `drafts/compositions/*.md` wherever possible.

### `sql/*` Is Ignored

Generated SQL files are local artifacts and not normally committed.
If a SQL file should become tracked, `.gitignore` needs to be changed intentionally.

## Type Checking

Run:

```bash
bun run typecheck
```

## Docker Notes

Docker commands may require elevated permissions in the Codex sandbox.
If Docker socket access fails, rerun with escalation.

## Git / Workspace Notes

- Do not revert user changes unless explicitly asked.
- The worktree may contain user-created files outside the current task.
- `.codex/`, and `AGENTS.md` may appear as local agent/tooling files. Do not edit them unless the user asks.
