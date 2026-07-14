# PST-003a slug候補の逐次レビュー画面

- フェーズ: P0
- 対応箇所: 設計書 §3.3、§10-1
- 想定サイズ: DB拡張マイグレーション1本相当
- 依存: PST-002
- 状態: レビュー待ち

## 目的

人間が `slug-candidates.json` を直接編集せず、`needs_review`
の候補を管理画面で1件ずつ確認し、既存のslug反映scriptへ渡せるレビューartifactを作成できるようにする。

## 実装範囲

- `app/slug-review`
  に候補artifactの読み込み、レビュー状態の保存、artifact出力APIを追加する。
- `app/admin-client/src/components/slug-review`
  に検索・候補状態フィルタ・人手判定フィルタ・次の未確認への移動・slug入力を追加する。
- 候補artifactは読み取り専用とし、レビュー結果は `slug-reviews.json`
  に分離して保存する。
- 既定のartifact位置は `drafts/slugs/slug-candidates.json`
  とし、ローカル検証では
  `SLUG_CANDIDATES_PATH`、`SLUG_REVIEWS_PATH`、`SLUG_CANDIDATE_ARTIFACT`
  で差し替えられるようにする。
- `approved` は小文字の英数字とハイフンによるslugを必須とし、`rejected` はslugを
  `null` として保存する。

## テスト方針

- repositoryのテストで、候補artifactを変更せずレビュー結果だけを別ファイルへ保存できることを確認する。
- repositoryのテストで、未知の候補・不正なapproved
  slugを拒否することを確認する。
- routesのテストで、artifact取得、判定保存、未確定statusの入力拒否を確認する。
- 画面状態のテストで、検索・候補状態・人手判定フィルタと候補順の「次の未確認」を確認する。
- 画面の契約テストで、キーボード操作可能なリスト、slug入力、対象外保存、artifact出力、`aria-live`を確認する。
- `bun run typecheck`、対象テスト、`bun run lint`、`bun run fmt:check`、`bun run admin:build`を受け入れ時に実行する。

## 受け入れ条件

- `needs_review`
  の未確認候補を、表示名・候補slug・診断内容・IDを見ながら1件ずつ確認できる。
- 「次の未確認」で候補artifactの順序に従って次の未確認へ移動できる。
- 自動候補を修正して `approved` として保存でき、対象外は `rejected`
  として保存できる。
- 保存後に `slug-candidates.json` が変更されず、`slug-reviews.json` が既存の
  `db:apply:slug-reviews` が受け取れる形で更新される。
- artifact出力で現在のレビュー結果をJSONとして取得できる。
- この画面の保存操作はDBを更新せず、DB反映は人間がartifactを確認した後に別途実行する。
- 空候補、NULLの既存slug、診断あり候補、衝突候補が画面上で判別でき、モバイル幅でも入力操作が崩れない。

## 人間レビュー手順

1. `SLUG_CANDIDATES_PATH`
   にレビュー対象の候補artifactを指定してadminを起動する。
2. `slug候補`
   画面を開き、既定の「要確認」「未確認」のまま「次の未確認」で順に進む。
3. 表示名・診断・候補根拠を確認し、必要ならslugを入力し直して「slugを承認」、公開しない行は「対象外として保存」を押す。
4. 未確認件数が0になったら「artifact出力」でJSONを保存し、内容を人間が確認する。
5. `bun run db:apply:slug-reviews -- --input <保存したslug-reviews.json>`
   を、別途承認を得た後に実行する。

### ローカルでの起動例

```sh
SLUG_CANDIDATES_PATH=./drafts/slugs/slug-candidates.json \
SLUG_REVIEWS_PATH=./drafts/slugs/slug-reviews.json \
bun run admin:dev
```

admin画面は `http://localhost:5173/admin/?resource=slug-review` から開く。
