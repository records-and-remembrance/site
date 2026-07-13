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
- 生成JSONのschema/version、`snapshotGeneratedAt`、内容ハッシュ、並び順、数値・NULL表現の固定。
  `snapshotGeneratedAt` は明示入力であり、現在時刻から暗黙に生成しない。
- releaseごとに、版アンカー専用の `editionKey` をexportする。これはDBのUUIDを公開せず、
  `format`・発売日・catalog#を正規化した基底名に、安定ID順の衝突連番を加えた値とする。
- publication / publication_issue / articleごとに、資料室anchor用の人間可読な `libraryKey` を
  exportする。表示名を正規化した基底名と安定ID順の衝突連番で決め、ページの並び替えでは変えない。
- `site:export` scriptと、全JSONを一時ディレクトリへ出して検証後に置換する出力手順。
  部分的に新旧snapshotが混在した状態を残さない。

## テスト方針

- 先に小さなfixture DB adapterを用意し、各JSONの型・必須項目・関連整合性を契約テストする。
- 同一fixtureから複数回生成したJSONが同一になることを検証する。
- NULLを勝手な空文字や推測値に変換しないこと、slug未確定を診断できることをテストする。
- fake adapterで、必要な読み取り結果から同じsnapshotを作れることと、client island用の
  payloadが操作に必要な項目だけであることを検証する。
- 同じ入力時刻を渡した同一fixtureでは、manifestを含めてbyte-for-byte同一になることを検証する。

## 受け入れ条件

- project、person、composition、work、release、recording、event、venue、publication、publication_issue、articleと必要な関連がexportされる。
- `/discography/:slug`、`/songs/:slug`、`/lives/:slug`で必要な関連を追加DBアクセスなしに描画できる。
- JSONは安定したキーと並び順を持ち、同じDB状態から差分のないスナップショットになる。
- export時に実行時APIを生成せず、サイト閲覧時のDBアクセスがゼロになる。
- 公開ルートを持つ行のslug欠落、参照切れ、日付値と精度の矛盾、artwork 3列の不整合は
  exportを止める。descriptionや記事本文など任意データの欠落は警告としてmanifestに記録する。
- 未解決データの警告と、公開を止めるエラーの区別がmanifestに記録される。

## 対象外

個別画面の見た目、slug候補の作成、Pagefindの検索index生成、client islandの重い機能実装。
