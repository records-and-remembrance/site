# PST-029 Cloudflare本番デプロイ

- フェーズ: P5
- 対応箇所: 設計書 §2、§9
- 想定サイズ: マイグレーション1本相当
- 依存: PST-005、PST-006、PST-028

## 目的

export→build→Cloudflare static assetsへのデプロイを、再現可能な公開導線にする。

## 実装範囲

- `wrangler deploy`の環境設定、project名、static assets、404設定、公開画像originの設定。
  静的サイトWorkerにはR2の書込bindingやadmin用secretを渡さない。
- hash付きJS/CSS/画像のimmutable cache、HTMLの更新方針。
- データ更新時の `site:release`（export → build → check → deploy）と、失敗時に古い公開物を
  壊さない順序。`site:deploy` 自体は検証済みの `site/dist` だけを公開する。
- deploy前の未解決slug・broken link・buildエラー検査。
- deploy後の代表URL smoke check。

## テスト方針

- 実デプロイ前にfixtureでexport→build→検査の一連を通す。
- wrangler設定をdry-run相当で検証し、DB接続なしの公開成果物を確認する。
- preview環境で代表route、cache header、画像URL、404をHTTP契約テストする。
- deploy失敗時に部分成果物を公開しないことを手順またはCIテストで確認する。

## 受け入れ条件

- `bun run site:release` が export → build → check → deploy を順に実行する実運用手順になる。
  `site:deploy` は検証済み成果物の再公開だけに単独利用できる。
- 閲覧時にPostgreSQLやHono APIへ接続しない。
- hash付きassetとHTMLのcache方針が設定どおりになる。
- hash付きassetはimmutable、HTMLは再検証可能な短いcache方針である。
- `/`、主要一覧、代表詳細、`/about`、404がCloudflare上で表示される。
- データ更新は再ビルド・再デプロイで反映され、手動DB接続を要求しない。

## 対象外

自動定期デプロイ、ユーザー認証、Cloudflare Workers APIの追加。
