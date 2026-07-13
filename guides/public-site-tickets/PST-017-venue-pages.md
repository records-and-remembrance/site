# PST-017 会場一覧・詳細

- フェーズ: P2
- 対応箇所: 設計書 §3.2、§4.7
- 想定サイズ: マイグレーション1本相当
- 依存: PST-008、PST-015

## 目的

会場を公演履歴と定番曲から辿り、孤立した会場も記録上の状態として正直に表示する。

## 実装範囲

- `/venues` の会場一覧、location、slug、event件数。
- `/venues/:slug` の年別公演履歴、project内訳、定番曲Top 5。
- event・project・composition・liveへのリンク。
- event 0件の会場8件の空状態。

## テスト方針

- 公演あり、複数project、定番曲同数、孤立venueをfixtureで先にテストする。
- venue slugとevent slugのリンクを契約として検証する。
- site側で表記ゆれを統合しないことを、異なるvenue行のfixtureで確認する。
- 定番曲の集計対象が当該venueのevent_performanceだけであることを検証する。

## 受け入れ条件

- `/venues` から会場詳細へ進める。
- 会場詳細に年別履歴とproject内訳が表示される。
- 定番曲Top 5から楽曲詳細へ遷移できる。
- event 0件の場合、「記録上の公演なし」と表示し、架空の件数を出さない。
- 会場名の名寄せをサイト表示時に行わない。

## 対象外

venueデータの修正、表記ゆれの統合、会場フィルタのURL状態管理。
