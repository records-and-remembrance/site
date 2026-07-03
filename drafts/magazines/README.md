# Magazine review drafts

`rawData/monden-magazine.tsv` をDBへ直接投入せず、掲載候補と要確認事項へ変換したレビュー用データです。

生成:

```bash
bun run review:magazines:generate
```

生成先:

- `monden-magazine.json`

## Review status

- `confirmed`: 分類と掲載情報に未確定表現がない
- `inferred`: 分類欄が空で、掲載内容の語句から分類を推定した
- `unresolved`: 複合分類、日付、号数、掲載有無などに確認が必要
- `not_published`: 「見つからず」「載ってない」などの否定情報がある

`confirmed` は機械判定上の状態であり、DB投入済みを意味しません。DBへのSQL生成は、人手で確認済みの候補を選択する別工程として実装します。

## Important fields

- `rawFields`: TSVの6フィールドを無加工で保持
- `sourceKey`: 原文から生成した安定キー
- `issue.issueKey`: 同じ雑誌・号数・発売日をまとめるキー
- `classificationSource`: `explicit` / `inferred` / `unresolved`
- `diagnostics`: 確認が必要になった理由
- `extracted`: ページ数、URL、作品名、イベント日付の機械抽出候補

月精度の日付は月初日に補完せず、`publishedDate: null` と `datePrecision: "month"` で保持します。
