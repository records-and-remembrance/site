# mondenDatabase

門田匡陽関連データを PostgreSQL に入れるための作業リポジトリです。

## Setup

PostgreSQL は Docker Compose で起動します。

```bash
docker compose up -d
```

初回起動時に `database.sql` が読み込まれ、schema が作成されます。

接続情報:

```text
host: localhost
port: 5432
database: monden
user: monden
password: monden
```

## Drizzle

Drizzle schema is defined in:

```text
app/db/schema.ts
```

Drizzle Kit config is defined in:

```text
drizzle.config.ts
```

Generated Drizzle migrations live in:

```text
drizzle/
```

For now, `database.sql` remains the Docker bootstrap source. Use Drizzle as the typed access layer and schema mirror first. The checked-in Drizzle migrations are for future Drizzle-managed databases; do not run `db:migrate` against a database that was already initialized from `database.sql`.

PostgreSQL comments are mirrored in `app/db/schema.ts` as TSDoc comments, but Drizzle Kit does not generate `COMMENT ON ...` statements from TSDoc. Keep comment DDL in custom migrations.

Type-check the Drizzle schema:

```bash
bun run typecheck
```

Check migration metadata:

```bash
bun run db:check
```

Generate a migration after changing `app/db/schema.ts`:

```bash
bun run db:generate
```

Apply migrations only to a fresh Drizzle-managed database:

```bash
DRIZZLE_DATABASE_URL=postgres://... bun run db:migrate
```

`db:migrate` intentionally requires `DRIZZLE_DATABASE_URL` so it is not accidentally run against the Docker database that was initialized from `database.sql`.

The default connection URL is:

```text
postgres://monden:monden@localhost:5432/monden
```

Set `DATABASE_URL` to override it.

## Raw Data

元データは Markdown です。

```text
rawData/articles/
```

整理済みデータは front matter の `tags[0]`、つまり1つめの tag を大カテゴリとして分けています。

```text
rawData/articles_by_category/
```

現在、release 系データは以下を入力にします。

```text
rawData/articles_by_category/release/
```

## Category Split

`rawData/articles/*.md` を `tags[0]` ごとにコピーして分類するスクリプトです。
元ファイルは移動しません。

```bash
bun run scripts/split_articles_by_first_tag.ts
```

出力先:

```text
rawData/articles_by_category/
```

## SQL Generation

生成 SQL は `sql/` に出力します。
`sql/*` は `.gitignore` 対象なので、必要なときに再生成します。

### Composition Drafts

`composition` は表記ゆれや同一曲判定が必要なので、まず RDB に直接入れず、Markdown のレビュー用下書きを作ります。

入力:

```text
rawData/articles_by_category/release/
rawData/articles_by_category/Live/
```

生成:

```bash
bun run scripts/generate_composition_drafts.ts
```

出力:

```text
drafts/compositions/
```

下書きは release 記事の `## 収録曲` / `## 曲リスト` と、Live 記事の `## セットリスト` から曲名候補を抽出します。
各ファイルで `canonical_title` / `aliases` / `status` を人間が確認・修正してから、DB 保存用 SQL に進みます。

レビュー方法:

```text
1. sources が多いファイルから確認する
2. canonical_title を正式な曲名に直す
3. 同一曲の表記ゆれを aliases に残す
4. 別曲が混ざっていたら、該当 source を別の draft md に分割する
5. 他の draft と同一曲だったら、片方に sources / aliases を寄せて、不要側は status: merged にする
6. DB に入れてよい状態になったら status: reviewed にする
```

`status` の意味:

```text
draft    自動生成直後。未確認。
reviewed 人間確認済み。DB 生成対象。
merged   他の draft に統合済み。DB 生成対象外。
split    別 draft に分割済み。DB 生成対象外。
ignore   曲として扱わない。DB 生成対象外。
```

レビュー時のルール:

- `canonical_title` は1曲に1つだけの代表表記にする
- `aliases` は表記ゆれだけを入れる
- 別バージョン名や演奏形態を同一曲として扱うかは人間が判断する
- `sources` は出典なので、誤抽出以外は基本的に消さない
- `composition_id` は未定なら `null` のままでよい
- 判断に迷うものは `status: draft` のまま残す

既存の下書き MD は人間が編集している可能性があるため、デフォルトでは上書きしません。
再生成したい場合は `--overwrite` を付けます。

```bash
bun run scripts/generate_composition_drafts.ts --overwrite
```

### Composition Review UI

`drafts/compositions/*.md` をブラウザで確認・編集する Hono 製の簡易UIです。

実装:

```text
app/server.ts
app/lib/compositionDrafts.ts
app/public/index.html
app/public/app.js
```

```bash
bun run review:compositions
```

起動後、以下を開きます。

```text
http://localhost:3000
```

できること:

- draft 一覧を `status` / 曲名 / ファイル名で絞り込む
- `canonical_title` を編集する
- `status` を `draft` / `reviewed` / `merged` / `split` / `ignore` に変更する
- `composition_id` を編集する
- `aliases` を1行1件で編集する
- review note 本文を編集する
- `sources` を読み取り専用で確認する
- current draft を target draft に merge する

保存すると該当の `drafts/compositions/*.md` が更新されます。
`sources` は出典情報なのでUIからは編集しません。
merge では current 側の `sources` / `aliases` が target 側へ追加され、current 側は `status: merged` になります。

### Release

release 記事から `project` / `work` / `release` / `label` / `distributor` などを生成します。

```bash
bun run scripts/generate_rawdata_seed_sql.ts \
  --source-dir rawData/articles_by_category/release \
  --types release \
  --output sql/release_seed.sql
```

### Composition / Recording / Track

レビュー済みの `drafts/compositions/*.md` から `composition` を生成します。
対象は `status: reviewed` のみです。

```bash
bun run scripts/generate_composition_seed_sql.ts \
  --output sql/composition_seed.sql
```

release 記事の `## 収録曲` または `## 曲リスト` から `composition` / `recording` / `track` を生成します。
`track.recording_id -> recording.composition_id` は、レビュー済み draft の `sources.raw_title` を使って正規化済み `composition` に紐づけます。

```bash
bun run scripts/generate_work_seed_sql.ts \
  --source-dir rawData/articles_by_category/release \
  --composition-draft-dir drafts/compositions \
  --output sql/release_tracks_seed.sql
```

この SQL は `track.release_id` が `release.id` を参照するため、先に `sql/release_seed.sql` を投入する必要があります。

### Live / Event Performance

live 記事から `project` / `venue` / `event` を生成します。

```bash
bun run scripts/generate_rawdata_seed_sql.ts \
  --source-dir rawData/articles_by_category/Live \
  --types live \
  --output sql/live_seed.sql
```

live 記事の `## セットリスト` から `event_performance` を生成します。
`event_performance.composition_id` は、レビュー済み draft の `sources.raw_title` を使って正規化済み `composition` に紐づけます。

```bash
bun run scripts/generate_live_performance_seed_sql.ts \
  --source-dir rawData/articles_by_category/Live \
  --composition-draft-dir drafts/compositions \
  --output sql/live_performances_seed.sql
```

### People / Membership

person 記事と biography 記事の `## メンバー` から `person` / `role` / `instrument` / `membership` / `membership_role` を生成します。

```bash
bun run scripts/generate_people_seed_sql.ts \
  --person-dir rawData/articles_by_category/person \
  --biography-dir rawData/articles_by_category/biography \
  --output sql/people_seed.sql
```

### Media / Article

media 記事から `publication` / `publication_issue` / `article` を生成します。
現時点では `article_mention_*` は生成せず、Markdown ソースファイルをまず DB に表現するための seed です。

```bash
bun run scripts/generate_media_seed_sql.ts \
  --source-dir rawData/articles_by_category/media \
  --output sql/media_seed.sql
```

方針:

- `publication`: 番組、TV 特番、Web掲載索引、ラジオ出演索引などの媒体コンテナ
- `publication_issue`: 放送回、掲載日、または索引用の synthetic issue
- `article`: 原則として media Markdown 1ファイルにつき1行

### Contribution

Live 記事の `サポートメンバー` から `contribution` を生成します。
初期スコープは event support credits のみで、release / recording credits は未対応です。

```bash
bun run scripts/generate_contribution_seed_sql.ts \
  --live-dir rawData/articles_by_category/Live \
  --output sql/contribution_seed.sql
```

生成内容:

- `person`: contribution で参照する人物が未作成の場合の補完
- `role`: `support_performer`
- `instrument`: support member 表記から正規化した楽器
- `contribution`: `event_id` のみを持つ live support contribution

## Import

投入順:

```text
1. sql/release_seed.sql
2. sql/composition_seed.sql
3. sql/release_tracks_seed.sql
4. sql/live_seed.sql
5. sql/live_performances_seed.sql
6. sql/people_seed.sql
7. sql/contribution_seed.sql
8. sql/media_seed.sql
```

Docker Compose で起動した PostgreSQL に投入する例:

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

## Notes

`scripts/generate_work_seed_sql.ts` は Markdown 本文全体を `notes` に保存しません。
生成される `notes` は追跡用の `source_file=...` 程度に留めています。

`rawData/articles_by_category/release/2016-01-20-033504.md` は「ライブ演奏のみの楽曲」のメモで、通常の release track list ではないため、`composition` / `recording` / `track` 生成対象からはスキップされます。
