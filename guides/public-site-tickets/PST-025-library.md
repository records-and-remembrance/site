# PST-025 資料室

- フェーズ: P4
- 対応箇所: 設計書 §3.2、§4.9
- 想定サイズ: マイグレーション1本相当
- 依存: PST-006、PST-007

## 目的

publication→issue→articleの階層を、エンティティリンクを推測せずに独立した資料室として提示する。

## 実装範囲

- `/library` のpublication、publication_issue、articleの階層ブラウズ。
- title、content、url、publishedDateの存在時のみ表示。
- article_mention_* が0件である現状に合わせ、相互リンクを作らない。
- 記事検索をPagefindへ渡すための検索対象マークアップ。
- 該当publication／issue／articleの空状態。

## テスト方針

- 97誌、335号、350記事相当の階層fixtureを小さくした形で先に検証する。
- content／url／publishedDateのNULL組合せと空階層をテストする。
- article_mentionが存在しない場合にエンティティリンクを出さないことを契約テストする。
- キーボードでpublication→issue→articleを辿れることをブラウザ確認する。

## 受け入れ条件

- 3段階の階層を一覧から詳細へ辿れる。
- NULL項目を空欄のプレースホルダで埋めず、存在する情報だけを表示する。
- 記事タイトルを検索indexへ提供できる。
- 設計書とUIの双方でmentionリンクが将来拡張であることを誤解なく扱う。
- 0件のpublication／issue／articleでも画面が成立する。

## 対象外

article_mention_* の生成、記事内容の新規収集、外部サイトのクロール。
