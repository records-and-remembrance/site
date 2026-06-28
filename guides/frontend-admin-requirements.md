# Frontend Admin Requirements

ローカル開発環境で、mondenDatabase の内容確認・データ修正・データ追加を行うための管理画面要件。

## Goal

- PostgreSQL 上の正規化済みデータを、人間が読みやすい単位で確認・編集できる。
- relation table や enum 代替の保持テーブルを、単独の主画面として扱わない。
- seed generator の補助ではなく、ローカルDBを直接編集する管理画面として作る。
- デプロイはしない。ローカル dev server で動けばよい。

## Technology Choices

- Server: existing `Hono` app.
- DB access: existing `Drizzle ORM` schema.
- Frontend: `Vite + React + TypeScript`.
- Data fetching/cache: `TanStack Query`.
- Large table state: `TanStack Table`.
- Accessible UI primitives: `React Aria Components`.
- Validation: `Zod`.
- Icons: `lucide-react`.
- Class utilities: `clsx`.

Do not use `React Hook Form` in v1. React Aria Components plus local React state is enough for the initial CRUD forms. Add React Hook Form later only if nested multi-row editing becomes complex.

Do not use Radix UI. React Aria Components covers the accessible primitives we need.

Do not use Drizzle Studio as the main UI. It can remain a developer fallback, but it does not provide the domain-oriented screens required here.

## Main Screens

Primary navigation should be organized by domain concepts:

- People
  - Main table: `person`.
  - Detail: memberships and membership roles.
- Projects
  - Main table: `project`.
  - Detail: members, works, events.
- Works / Releases
  - Main table: `work`.
  - Detail: releases, labels, tracks.
- Compositions / Recordings
  - Main table: `composition`.
  - Detail: recordings and appearances.
- Events
  - Main table: `event`.
  - Detail: venue and event performances.
- Articles
  - Main table: `article`.
  - Detail: publication issue, publication, mentions.
- Contributions
  - Main table: `contribution`.
  - Detail display should resolve person, role, instrument, and target.

## Tables Without Standalone Main Views

These tables should be edited or displayed only through parent/detail screens:

- `membership`
- `membership_role`
- `label_relation`
- `track`
- `recording`
- `event_performance`
- `publication_issue`
- `article_mention_work`
- `article_mention_event`
- `article_mention_person`

Lookup/master tables should normally appear as searchable selectors or compact management dialogs:

- `role`
- `instrument`
- `label`
- `distributor`
- `venue`
- `publication`

## Editing Policy

- v1 supports create and update.
- v1 does not support delete.
- UUIDs are generated server-side.
- Foreign keys must be selected by human-readable labels, not raw UUID entry.
- Database constraint errors should be converted into actionable API errors.
- Existing `description` and `notes` fields may be displayed and edited, but description enrichment is not a priority.

## UI Behavior

- Every main screen has search, sort, pagination, and a detail panel/page.
- Tables show resolved names for foreign keys.
- Editing happens in forms using React Aria Components.
- Related rows are added from the parent detail screen.
- Forms should preserve unsaved-change state and confirm before discarding.
- Use local dev server only; no auth, deployment, or multi-user conflict handling in v1.

## API Shape

Use Hono routes under `/api/admin`.

Recommended route groups:

- `GET /api/admin/:resource`
- `GET /api/admin/:resource/:id`
- `POST /api/admin/:resource`
- `PUT /api/admin/:resource/:id`
- `GET /api/admin/lookups/:resource`

Resource names should match domain screens, not always raw table names. Example: `works` can return joined work/release summary data.

## Acceptance Criteria

- The app can browse primary records without exposing UUID-first workflows.
- The app can create and update records for at least People, Projects, Works/Releases, and Events in the first usable milestone.
- Relation rows needed by those screens are handled inside parent detail screens.
- `bun run typecheck` passes.
- The local server can be started with a documented npm/bun script.
