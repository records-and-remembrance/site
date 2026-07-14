# PST-030 リリース候補受け入れ記録

## 判定

受け入れ待ち（コード側のfixture検査は合格。実DBの公開対象slug確定後に本番候補データで再確認する）

## 実施情報

- 実施日: 2026-07-13
- 実施者: Codex
- snapshot: `site/src/data/site.json` の空fixture（全テーブル0件、`contentHash` は空文字）
- リリース候補commit: 本コミット（PST-028/PST-030）
- 失敗時の戻し先: PST-003（slug確定値）→ PST-006（実DB export）

## 実行コマンド

fixtureを使った公開成果物の確認として、次を実行した。

```text
bun test --max-concurrency=1
bun test scripts/site_check.test.ts
bun run typecheck
bun run site:build
bun run site:search:index
bun run site:check
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

- `ANALYZE`、黄金の鐘、複数プロジェクト人物、孤立venue、live-only、track 0件
- NULL／日付精度／未来event、reissue、前後公演、資料室article anchor
- 実DBsnapshotのmanifest `contentHash` と対象URLのリンクグラフ
- Cloudflare previewのcache header、画像origin、404
