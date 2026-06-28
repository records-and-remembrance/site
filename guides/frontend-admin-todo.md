# Frontend Admin TODO

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Done

## Phase 1: Project Setup

- [x] Add frontend dependencies.
  - `vite`
  - `react`
  - `react-dom`
  - `@vitejs/plugin-react`
  - `@tanstack/react-query`
  - `@tanstack/react-table`
  - `react-aria-components`
  - `zod`
  - `lucide-react`
  - `clsx`

- [x] Add TypeScript frontend build setup.
  - Add Vite config.
  - Add client entrypoint.
  - Keep existing Hono server for API.
  - Add scripts for local admin dev server.

- [x] Decide URL layout.
  - Keep existing composition review UI reachable.
  - Add admin UI under a separate route such as `/admin`.

## Phase 2: API Foundation

- [x] Add `/api/admin` route module.
  - Shared JSON error shape.
  - Zod request validation.
  - Server-side UUID generation.
  - Constraint error mapping.

- [x] Add lookup APIs.
  - `project`
  - `person`
  - `composition`
  - `work`
  - `release`
  - `venue`
  - `role`
  - `instrument`
  - `label`
  - `distributor`
  - `publication`

- [x] Add list/detail/update/create APIs for first milestone.
  - People
  - Projects
  - Works/Releases
  - Events

## Phase 3: Shared UI

- [x] Build app shell.
  - Sidebar navigation.
  - Search header.
  - Error/loading states.

- [x] Build reusable table components.
  - TanStack Table state.
  - Search, sort, pagination.
  - Human-readable foreign key display.

- [x] Build reusable form components with React Aria Components.
  - Text field.
  - Date field.
  - Number field.
  - Select.
  - ComboBox for foreign keys.
  - Modal/dialog.
  - Tabs.

## Phase 4: First Usable Screens

- [x] People screen.
  - List and search people.
  - Create/update `person`.
  - Show memberships in detail.
  - Add/update membership from person detail.

- [x] Projects screen.
  - List and search projects.
  - Create/update `project`.
  - Show related members, works, and events.

- [x] Works/Releases screen.
  - List works with project and release summary.
  - Create/update `work`.
  - Add/update `release` from work detail.
  - Add/update labels through work/release detail, not a standalone `label_relation` view.

- [x] Events screen.
  - List events with project and venue names.
  - Create/update `event`.
  - Select/add venue through the event form.
  - Show event performances in detail.

## Phase 5: Remaining Screens

- [x] Compositions/Recordings screen.
- [x] Articles screen.
- [x] Contributions screen.
- [x] Compact management dialogs for lookup/master tables.

## Explicitly Out of Scope For v1

- [ ] Delete operations.
- [ ] Auth.
- [ ] Deployment.
- [ ] Multi-user conflict handling.
- [ ] Editing seed files or regenerating source Markdown.
- [ ] Making Drizzle Studio the main UI.
