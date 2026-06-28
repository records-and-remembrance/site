# Project Instructions

## Shell Commands

- Use `docker compose exec -T postgres psql -U monden -d monden` for PostgreSQL access.
- The project-local Codex rule is defined in `.codex/rules/default.rules`.

## Project Guides

Refer to these files when the task touches project structure, data modeling, or seed generation:

- `guides/project-overview-for-agents.md`
- `guides/data-structure.md`

## Developer Notes

- t-wadaの提唱するTDDの考え方に従い、まずテストコードを書き、次に実装コードを書き、最後にリファクタリングする
- 人間がレビューしやすいように、目安として1000行以上の変更を加えたら1つのコミットにまとめる。テストと実装コードで1つのコミットにまとめるという単位が望ましい
