# PST-005 Astroサイトとビルド導線

- フェーズ: P1
- 対応箇所: 設計書 §2、§9
- 想定サイズ: マイグレーション1本相当
- 依存: なし

## 目的

`site/` を既存adminから独立したAstro SSGとして立ち上げ、DBなしで静的成果物を生成できる最小導線を作る。

## 実装範囲

- `site/` のAstro設定、TypeScript設定、依存関係、静的asset設定。
- `wrangler.jsonc` とCloudflare Workers static assets設定。
- `site:export`、`site:build`、`site:deploy` のpackage script契約。
- 最小のindexページと、ビルド成果物に実行時APIサーバーを含めない構成。

## テスト方針

- 先にpackage scriptとビルド成果物の契約を定義するテストを追加する。
- DBを停止した状態でも、fixture dataを使うsite buildが成功することを確認する。
- 出力HTMLにサイトの最低限のtitleとmain landmarkがあることを検証する。
- Cloudflareへの実デプロイはこのチケットでは行わず、設定の構文・静的asset契約を検証する。

## 受け入れ条件

- `site/` が既存の `app/` のadminビルドやルーティングを壊さない。
- fixture dataだけで `bun run site:build` が成功する。
- 実行時のDB接続、Hono API、`/api/site/*` 集約エンドポイントを必要としない。
- `bun run site:export && bun run site:build && bun run site:deploy` を順に実行できるscript名が存在する。
- Astroのルート設定とCloudflare static assetsの出力先が一致する。

## 対象外

DBからの実データexport、各画面、R2画像、実際の本番デプロイ。
