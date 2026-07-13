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
- eventの `YYYY-MM-DD-<venue-slug>` 生成。同じ候補になる複数eventは、確定済みの
  project slug、次に安定IDでソートし、先頭を素の候補、以降を `-2` から採番する。
- 既存の確定slugを上書きしない保護と、変更が必要な場合の旧→新リダイレクトmanifest。
- リダイレクトはレビューartifactに旧slugを明示して要求する。循環、連鎖、同じ旧slugの
  再利用は反映前にエラーにする。

## テスト方針

- `draft`、`approved`、`rejected`、未解決候補を先にfixtureテストする。
- 同じartifactを二度反映しても結果・件数が変わらないことを検証する。
- eventの通常ケース、別projectによる同日・同会場衝突、venue slug欠落、既存slug保持を
  テストする。
- 実DBではunique制約・NULL許容・確定値の不変性をSQLで確認する。

## 受け入れ条件

- 対象5種の、現在公開する全行の承認済みslugをDBへ反映できる。`scope = 'monden'` の
  公開対象にslug欠落を残さない。後から追加するexternal行も公開前に同じレビューを通す。
- 未承認・空・衝突解決前の候補は公開用slugとして反映されない。
- event slugが同じ入力から毎回同じ値になり、同日衝突は `-2` 以降で解決される。
- 既存の公開slugは入力名の変更だけでは変わらない。
- 変更時に旧slugから新slugへの静的リダイレクトmanifestを生成できる。

## 対象外

slugを編集するadmin画面そのもの、Astroの動的ルート、全件のslugを一度に必須化するDB変更。
