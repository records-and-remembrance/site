# Git から公開サイトをビルドする

公開サイトのビルド入力は `site/src/data/site.generated.json`。ローカル PostgreSQL から生成した公開用スナップショットを Git にコミットし、Cloudflare Workers Builds が `main` への push ごとに静的サイトをビルド・デプロイする。PostgreSQL の dump や接続情報は Git に含めない。

## ローカルでデータを更新する

ローカル PostgreSQL を起動し、必要な migration とデータ更新を適用してから、スナップショットを生成する。

```sh
bun site/export/export.ts --snapshot-generated-at "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
bun run site:build:published
git add site/src/data/site.generated.json
git commit -m "公開サイトのデータを更新"
git push origin main
```

スナップショットは公開リポジトリに載る。初回コミット時とデータ内容を大きく変えたときは、公開してよい情報だけが含まれることを確認する。生成処理は内部メタデータを自由記述欄から除去し、参照整合性にエラーがあれば書き込みを止める。

## Cloudflare Workers Builds

既存 Worker `records-and-remembrance-site` の **Settings → Builds** でこの GitHub リポジトリを接続する。Workers Builds の設定値は次のとおり。

| 項目 | 値 |
| --- | --- |
| Root directory | `/` |
| Production branch | `main` |
| Build command | `bun run site:build:published` |
| Deploy command | `bun run site:deploy` |
| Build variable | `BUN_VERSION=1.4.2` |

`site:build:published` はスナップショットがない場合に失敗し、Astro ビルド、Pagefind の索引生成、静的成果物の検査を順に実行する。`site:release` はローカルで export からデプロイまで実行する従来の手順で、Cloudflare の build command には使わない。

Cloudflare に接続する GitHub App には、このリポジトリへのアクセスを許可する。Wrangler の Worker 名は `site/wrangler.jsonc` の `name` と一致させる。
