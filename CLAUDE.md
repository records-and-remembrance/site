# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## 目的

このリポジトリは、門田匡陽関連のプロジェクト・リリース・ライブ・楽曲・人物・メンバーシップに
関する正規化された PostgreSQL データベースを構築する。中核となる作業は、
`rawData/articles_by_category/` 配下の半構造化 Markdown を `app/db/schema.ts`
で定義された
リレーショナルデータへ変換すること。加えて、そのデータを編集するためのローカル
Hono + React 管理／レビュー UI も同梱している。

ランタイム・ツールチェーンは全体を通して **Bun**（Node/npm
ではない）。lint/format は **oxc**
ツールチェーン（`oxlint`/`oxfmt`）を使い、ESLint/Prettier は使わない。

## コマンド

```bash
# データベース（PostgreSQL は compose.yaml 経由の Docker で起動。DB/user/pass はすべて "monden"、:5432）
docker compose up -d          # PostgreSQL を起動
bun run db:migrate            # drizzle/ の未適用マイグレーションを DATABASE_URL（未設定ならローカル既定 URL）へ適用
bun run db:generate           # app/db/schema.ts を編集した後にマイグレーションを生成
bun run db:check              # マイグレーションメタデータを検証
bun run db:studio             # Drizzle Studio を開く

# 開発サーバー
bun run admin:dev             # admin:server (:3000) と admin:client (:5173) を同時に起動
bun run admin:server          # Hono API のみ、app/server.ts を :3000 で起動（bun --watch）
bun run admin:client          # Vite React クライアントのみを :5173 で起動、/api を :3000 へプロキシ
bun run admin:build           # 本番 Vite ビルド -> dist/admin

# 品質チェック
bun run typecheck             # tsc --noEmit（schema + scripts + app を対象）
bun run lint                  # oxlint（自動修正は lint:fix）
bun run fmt                   # oxfmt（検証のみは fmt:check）
bun test                      # 全テスト（Bun 組み込みランナー）
bun test app/admin/routes.test.ts          # 単一テストファイル
bun test --test-name-pattern "<substring>" # 名前で単一テストを指定
```

> 注意: `README.md` は `bun run db:setup` を参照しているが、そのスクリプトは
> `package.json` に存在しない。代わりに `docker compose up -d` の後に
> `bun run db:migrate` を実行すること。

DB 接続の既定は `postgres://monden:monden@localhost:5432/monden`。
`DATABASE_URL` で上書きできる。

## アーキテクチャ

### 2 つの構成要素: データパイプラインと管理アプリ

**1. シード生成パイプライン**（`scripts/` + `sql/` + `rawData/` + `drafts/`）

意図的に段階的で、人間の判断を挟むフロー:
`rawData の Markdown → 生成スクリプト → sql/*.sql シード → PostgreSQL へインポート`。

- `scripts/generate_*_seed_sql.ts` — `rawData/` を解析し `sql/` へ SQL
  を出力する Bun スクリプト。 共通のパース補助は `scripts/lib/` にある。
- `sql/` は **git 管理外**（`sql/*`）—
  生成されたシードはローカル成果物。概要・品質チェック用の
  SQL（`*_overview.sql`, `*quality_checks.sql`）もここに置かれ、
  `docker compose exec -T postgres psql -U monden -d monden < sql/<file>.sql`
  で実行する。
- インポート順序は重要。`README.md` の順序リストを参照 （releases → labels →
  compositions → tracks → live/events → people → contributions → media）。

**2. 管理／レビューアプリ**（`app/`）

- `app/server.ts` — Hono のエントリ。3 つの機能ルーターを `/api/admin`、
  `/api/recording-organizer`、`/api/magazine-review` 配下に合成し、加えて
  composition draft の エンドポイントを提供する。
- 各機能（`app/admin/`, `app/recording-organizer/`,
  `app/magazine-review/`）は同じ構成に従う: `routes.ts`（Hono ハンドラ）+
  `repository.ts`（DB アクセス）+ `types.ts`。repository はテスト用に
  差し替え可能。
- `app/db/schema.ts` が **スキーマの唯一の情報源**。`app/db/index.ts` が Drizzle
  の `db` クライアントをエクスポートする。`drizzle/`
  にマイグレーション履歴を保持。
- `app/admin/repository/` はデータ駆動: `resourceTables` がリソース名を Drizzle
  テーブルへ 対応付け、リソースごとに from/select/search/sort
  の読み取り定義を宣言する。関連エンティティの ローダーは
  `app/admin/repository/<entity>/load-related.ts` にある。
- `app/admin-client/` は React 19 + Vite クライアント（React Aria
  Components、TanStack Query/Table、URL 状態管理に nuqs）。画面は
  `src/components/<screen>/` 配下にまとめられ、 コンポーネント + API アダプタ +
  state + テストを同梱する。共有の `resources.ts` が編集可能な
  リソース／フィールド設定を宣言し、サーバー側と対応する。

### 重要なデータルール（guides/project-overview-for-agents.md より）

- **タグはプロジェクト名ではない。** Markdown
  の最初のタグは大分類（`Release`、`Live`、
  `参加バンド`、`人物`）。以降のタグはメタデータの場合があり、`generate_rawdata_seed_sql.ts`
  は 既知の非プロジェクトタグ（`予定`、`単独ライブ`、`Album`、`Sg`、`DVD`
  など）を明示的に除外する。
- **一部のページはエンティティではなく索引／メモページ**であり、ジェネレーターがスキップする
  （例: `README.md` の "Notes"
  に挙げられたデモ一覧やライブ演奏のみの楽曲メモ）。
- **楽曲（composition）は人手でレビューする。** 正規の `composition` 行は raw
  タイトルから直接 ではなく、`status: reviewed` の `drafts/compositions/*.md`
  から生成する。楽曲レビュー UI
  （`bun run review:compositions`、http://localhost:3000）がそれらの draft
  を直接編集する。
- **Drizzle Kit は `COMMENT ON` を出力しない。** `schema.ts` の TSDoc
  コメントは人間向けに Postgres コメントを反映するが、コメント DDL
  はカスタムマイグレーションに手書きする必要がある。

## 規約

- TypeScript は strict
  で、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、
  `verbatimModuleSyntax` を有効にしている。型のみのインポートは `import type`
  を使い、 `.ts`/`.tsx`
  拡張子付きインポートを行う（`allowImportingTsExtensions`）。
- テストはソースの隣に `*.test.ts(x)` で同居し、Bun のランナーで実行する。
- パイプライン作業の詳細は `guides/project-overview-for-agents.md` と `guides/`
  配下の他の ドキュメントにある。
