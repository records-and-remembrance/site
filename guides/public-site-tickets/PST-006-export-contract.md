# PST-006 DB→静的JSON export契約

- フェーズ: P1
- 対応箇所: 設計書 §2、§3、§5、§10
- 想定サイズ: マイグレーション1本相当
- 依存: PST-001、PST-003、PST-005

## 目的

ローカルPostgreSQLの正規化データを、Astroがビルド時に読む型付き・決定的なJSONスナップショットへ変換する。

## 実装範囲

- `app/db/schema.ts`をSSoTとして読むexport処理と依存注入可能なDB adapter。
- 一覧用の軽量データ、詳細用の関連データ、件数、Dig用index、MM-DD用indexの出力契約。
- slug未確定、参照切れ、日付不正などのexport診断とビルド失敗条件。
- 生成JSONのschema/version、並び順、数値・NULL表現の固定。

## テスト方針

- 先に小さなfixture DB adapterを用意し、各JSONの型・必須項目・関連整合性を契約テストする。
- 同一fixtureから複数回生成したJSONが同一になることを検証する。
- NULLを勝手な空文字や推測値に変換しないこと、slug未確定を診断できることをテストする。
- DB接続の生成・終了をadapterの外から直接参照しない構造を、振る舞いテストとtypecheckで確認する。

## 受け入れ条件

- project、person、composition、work、release、recording、event、venue、publication、publication_issue、articleと必要な関連がexportされる。
- `/discography/:slug`、`/songs/:slug`、`/lives/:slug`で必要な関連を追加DBアクセスなしに描画できる。
- JSONは安定したキーと並び順を持ち、同じDB状態から差分のないスナップショットになる。
- export時に実行時APIを生成せず、サイト閲覧時のDBアクセスがゼロになる。
- 未解決データの警告と、公開を止めるエラーの区別が記録される。

## 対象外

個別画面の見た目、slug候補の作成、Pagefindの検索index生成。
