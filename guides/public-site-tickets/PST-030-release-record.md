# PST-030 リリース候補受け入れ記録

## 判定

受け入れ待ち（コード側のfixture検査は合格。実DBの公開対象slug確定後に本番候補データで再確認する）

## 実施情報

- 実施日: 2026-07-14
- 実施者: Codex
- snapshot: `site/src/data/site.json` の空fixture（全テーブル0件、`contentHash` は空文字）
- リリース候補commit: `b1220ea`（PST-028/PST-030のfixture確認）
- 失敗時の戻し先: PST-003（slug確定値）→ PST-006（実DB export）
- DB候補snapshot: `db-2026-07-14T00:00:00Z`
- DB候補artifact: `/private/tmp/monden-slug-candidates-20260714.json`
- DB候補結果: 558件、提案198件、人手レビュー360件、既存slug保持0件、衝突0件

## 実行コマンド

fixtureを使った公開成果物の確認として、次を実行した。

```text
bun test --max-concurrency=1
bun test scripts/site_check.test.ts
bun test scripts/site_smoke_check.test.ts scripts/site_release.test.ts
bun run typecheck
bun run site:build
bun run site:search:index
bun run site:check
bun run db:generate:slug-candidates -- --source-snapshot db-2026-07-14T00:00:00Z --output /private/tmp/monden-slug-candidates-20260714.json
```

実デプロイ時のみ、公開先を明示して次を実行する。今回の受け入れでは未実行。

```text
SITE_SNAPSHOT_GENERATED_AT=2026-07-14T00:00:00.000Z SITE_PUBLIC_URL=https://<preview-host> bun run site:release
```

確認済みの成果物は、トップ、404、about、projects、people、discography、songs、lives、venues、network、timeline、library、search、およびPagefind indexである。`site:check` は内部リンク、anchor、PostgreSQL/API参照を検査する。

## ブラウザ確認

- 確認URL: `/`, `/discography/`, `/lives/`, `/timeline/`, `/search/`, `/about/`, `/network/`
- viewport: 320px／640px／1024pxの境界はPST-028契約テスト、デスクトップ幅はin-app browserで確認
- 確認項目: モバイル横溢れ、キーボードfocus、URLフィルタ直開き、404、Pagefind読み込み、閲覧時のDB/APIリクエスト0件
- 実施結果: Codexのin-app browserでホーム全画面を撮影し、テーマ・ナビゲーション・0件表示・Dig fallback・footerを目視確認した。主要routeのDOM snapshotも読み込み確認済み。
- screenshot: fixtureのホーム画面を会話側のbrowser artifactとして確認（repositoryには生成画像を保管しない）

## 未確認・既知のブロッカー

実DBでexportを実行したところ、公開ページ対象のslug未確定診断 `PUBLIC_SLUG_MISSING` が953件発生してexportが停止した。表示名やUUIDをslugへフォールバックして公開することは禁止しているため、slugレビューartifactを確定してからPST-006の実DBsnapshotで次の確認を行う。

DBの公開対象件数とslug設定状況は次のとおりで、slug設定済みは全種別0件だった。

| 種別        | 行数 | slug設定済み |
| ----------- | ---: | -----------: |
| project     |    8 |            0 |
| person      |  112 |            0 |
| composition |  218 |            0 |
| work        |   64 |            0 |
| venue       |  156 |            0 |
| event       |  395 |            0 |

- `ANALYZE`、黄金の鐘、複数プロジェクト人物、孤立venue、live-only、track 0件
- NULL／日付精度／未来event、reissue、前後公演、資料室article anchor
- 実DBsnapshotのmanifest `contentHash` と対象URLのリンクグラフ
- Cloudflare previewのcache header、画像origin、404、deploy後smoke check
