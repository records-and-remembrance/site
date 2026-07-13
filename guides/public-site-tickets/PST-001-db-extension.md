# PST-001 DB拡張マイグレーションと契約確認

- フェーズ: P0
- 対応箇所: 設計書 §3.3、§4.5、§4.8、§10
- 想定サイズ: マイグレーション1本相当
- 現状: `drizzle/0011_aromatic_carnage.sql` と `app/db/schema.ts` に主要部分が実装済み。重複するmigrationは作らず、適用状態と不足を確認する。
- 補足: このmigrationは画像3列の追加までを担当する。URL・幅・高さを常に一組に
  する制約はPST-004が追加migrationで確定する。
- 依存: なし

## 目的

公開URL、ジャケット画像、networkの外部プロジェクトを支えるDB契約を、schema SSoTとmigrationの両方で確定する。

## 実装範囲

- `project` / `person` / `composition` / `work` / `venue` / `event` の nullable・uniqueな `slug`。
- `release.artworkUrl` / `artworkWidth` / `artworkHeight`。
- `project.scope` の `NOT NULL DEFAULT 'monden'` と `monden | external` CHECK。
- 既存行を壊さずにmigrationを適用できること、schemaテストとmigration履歴を整合させること。

## テスト方針

- 先にschema契約テストを書き、列、nullable、default、unique、CHECKを検証する。
- 空DBへのmigration適用テストと、既存データを投入したDBへの適用テストを分ける。
- 既存slugがNULLのままでも適用でき、既存行の件数・主キー・既存値が変わらないことをSQLで確認する。
- migrationを再適用したときに重複DDLを実行しないことを、migration管理コマンドの契約として確認する。

## 受け入れ条件

- `app/db/schema.ts` と `drizzle/` が§10の列・制約を同じ名前で表している。
- 既存データを保持したDBに適用できる。
- `project.scope` の未指定INSERTは `monden` になり、不正値はDBで拒否される。
- slugの重複はDBで拒否され、NULLはslug充足前の既存データとして許容される。
- `bun run typecheck`、`bun test`、`bun run db:check` が成功する。

## 対象外

slug値の生成・レビュー、R2へのファイル転送、公開サイトの画面実装。
