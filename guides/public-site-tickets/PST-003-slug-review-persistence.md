# PST-003 slugレビュー・確定値反映

- フェーズ: P0
- 対応箇所: 設計書 §3.3、§10-1
- 想定サイズ: マイグレーション1本相当
- 依存: PST-002

## 目的

人手レビュー済みのslugをDBへ反映し、eventを含む公開URLを再現可能かつ変更に強い状態にする。

## 実装範囲

- レビューartifactのstatusと承認値の定義。
- approved値だけを対象にしたidempotentなDB反映。
- eventの `YYYY-MM-DD-<venue-slug>` 生成と同日衝突時の連番。
- 既存の確定slugを上書きしない保護と、変更が必要な場合の旧→新リダイレクトmanifest。

## テスト方針

- `draft`、`approved`、`rejected`、未解決候補を先にfixtureテストする。
- 同じartifactを二度反映しても結果・件数が変わらないことを検証する。
- eventの通常ケース、同日衝突、venue slug欠落、既存slug保持をテストする。
- 実DBではunique制約・NULL許容・確定値の不変性をSQLで確認する。

## 受け入れ条件

- 承認済みの5エンティティのslugをDBへ反映できる。
- 未承認・空・衝突解決前の候補は公開用slugとして反映されない。
- event slugが同じ入力から毎回同じ値になり、同日衝突は `-2` 以降で解決される。
- 既存の公開slugは入力名の変更だけでは変わらない。
- 変更時に旧slugから新slugへの静的リダイレクトmanifestを生成できる。

## 対象外

slugを編集するadmin画面そのもの、Astroの動的ルート、全件のslugを一度に必須化するDB変更。
