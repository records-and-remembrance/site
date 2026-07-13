# PST-029 Cloudflare本番デプロイ

- フェーズ: P5
- 対応箇所: 設計書 §2、§9
- 想定サイズ: マイグレーション1本相当
- 依存: PST-005、PST-006、PST-028

## 目的

export→build→Cloudflare static assetsへのデプロイを、再現可能な公開導線にする。

## 実装範囲

- `wrangler deploy`の環境設定、project名、static assets、必要なR2／Images参照設定。
- hash付きJS/CSS/画像のimmutable cache、HTMLの更新方針。
- データ更新時の一括コマンドと、失敗時に古い公開物を壊さない順序。
- deploy前の未解決slug・broken link・buildエラー検査。
- deploy後の代表URL smoke check。

## テスト方針

- 実デプロイ前にfixtureでexport→build→検査の一連を通す。
- wrangler設定をdry-run相当で検証し、DB接続なしの公開成果物を確認する。
- preview環境で代表route、cache header、画像URL、404をHTTP契約テストする。
- deploy失敗時に部分成果物を公開しないことを手順またはCIテストで確認する。

## 受け入れ条件

- `bun run site:export && bun run site:build && bun run site:deploy` が実運用手順になる。
- 閲覧時にPostgreSQLやHono APIへ接続しない。
- hash付きassetとHTMLのcache方針が設定どおりになる。
- `/`、主要一覧、代表詳細、`/about`、404がCloudflare上で表示される。
- データ更新は再ビルド・再デプロイで反映され、手動DB接続を要求しない。

## 対象外

自動定期デプロイ、ユーザー認証、Cloudflare Workers APIの追加。
