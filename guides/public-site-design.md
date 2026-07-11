# 門田匡陽データベース 閲覧サイト設計書

status: revised draft（レビューコメント反映済み、再レビュー待ち）
audience: レビュー後にこのサイトを実装するエージェント / 人間レビュアー
data source: ビルド時にローカル PostgreSQL（`postgres://monden:monden@localhost:5432/monden`）から静的データを書き出す。実行時（閲覧時）の DB アクセスはゼロ
schema SSoT: `app/db/schema.ts`

---

## 1. コンセプト

**「名義は変わっても、曲は旅を続ける」**

門田匡陽の活動は sweet girls（1994）からサンチェスター・ユナイテッドFC、BURGER NUDS、Good Dog Happy Men、ソロ名義、Poet-type.M、そして現行のソロ名義まで、8つのプロジェクトにまたがる。このサイトは単なるディスコグラフィ一覧ではなく、**プロジェクト横断の「線」を見せることで、閲覧者（=データ入力者自身を含む）が知らなかった事実を発見できる**ことを第一の目的とする。

DB実データが支える3つの発見軸:

1. **人の線** — 伊藤大地（5プロジェクト）、内田武瑠（5）、河相巧矢（3）ら常連メンバーがキャリアを跨いで合流する構造（membership 59行 + contribution 961行）
2. **曲の線** — 「ANALYZE」は7リリースに収録、「黄金の鐘」は5録音バージョン。再録・アコースティック再演・名義を跨ぐ再演（recording 295行 / track 375行）
3. **場所と時間の線** — 下北沢GARAGE 57公演、新宿LOFT 42公演というホームグラウンドの変遷、セットリスト3,275行が語る「この曲が◯年ぶりに演奏された」（event 395行 / event_performance 3,275行）

閲覧モードは「調べる」（検索・フィルタ・一覧）と「彷徨う」（ランダム到達・関連リンクの回遊）の両方を等価にサポートする。

## 2. 技術構成と配置

既存 admin アプリ（`app/`、Hono + React 19 + Vite + TanStack Query）の規約は踏襲しない。公開サイトは要件が別物であり、独立したスタックを新設する。方針は **完全静的生成（SSG）+ Cloudflare で完結**。

- **実行時の DB アクセスはゼロ**。データはパイプラインでバッチ更新されるため、ビルド時にローカル PostgreSQL から静的データを書き出す。生成した HTML・JSON・アセットはすべて Cloudflare の CDN キャッシュに乗る。キャッシュ最優先・軽量表示・「彷徨う」体験を妨げないことを最優先の設計原則とする。
- フレームワークは **Astro**（SSG ファースト、デフォルト JS ゼロ）。年表フィルタ・network グラフ・Dig などの対話要素だけを island として実装し、それ以外は静的 HTML のみで完結させる。
- ホスティングは **Cloudflare Workers の static assets**（`wrangler deploy`）。API サーバーは作らない（旧設計にあった `/api/site/*` 集約エンドポイント方針は廃止）。

```
site/                        # リポジトリ直下に新設。admin の app/ とは独立
  astro.config.mjs
  wrangler.jsonc
  export/                    # `app/db/schema.ts` を import し、ローカル DB から静的スナップショットを書き出す Bun スクリプト
    export.ts                # -> site/src/data/*.json（schema.ts が引き続き SSoT）
  src/
    pages/                   # ファイルベースルーティング（§3.2 ルート一覧に対応）
    components/              # 画面ごとの Astro コンポーネント + island（*.tsx）
    styles/tokens.css         # §7 のデザイントークン
    data/                    # export.ts が生成する JSON スナップショット（git 管理外）
```

動的に見える機能はすべてビルド時静的化する:

- **Dig（ランダム到達）**: ビルド時に生成する軽量インデックス JSON（全エンティティの slug + 種別 + 一言）を export し、クライアント JS がランダムに 1 件選んで遷移する。
- **この日なんの日**: MM-DD をキーにした JSON をビルド時に生成し、クライアントが今日の日付でルックアップする。
- **検索**: Pagefind 等のビルド時インデックスによるクライアントサイド検索（サーバーへの問い合わせなし）。

キャッシュ方針: ハッシュ付きアセット（JS/CSS/画像）は `immutable`、HTML はデプロイのたびに更新される。**データ更新 = 再ビルド & 再デプロイ**。package.json に `site:export`（DB→JSON）/ `site:build`（Astro ビルド）/ `site:deploy`（wrangler deploy）を追加し、`bun run site:export && bun run site:build && bun run site:deploy` でまとめて更新できるようにする。

画像（ジャケット）は **Cloudflare R2** に保管し、`<img>` に `width` / `height` を明示（レイアウトシフト防止）+ `loading="lazy"` + Cloudflare Images のリサイズ変換で配信する。R2 の URL は `release.artworkUrl` に保存する（§10）。

## 3. 情報アーキテクチャ

### 3.1 ことばの整理（サイトに登場する概念）

DB のテーブル名とサイト上の表記は一致しない。実装エージェントがコードとコピーで混同しないよう対応をここで固定する。

| DB概念 | サイト表記 | 説明 |
|---|---|---|
| project | プロジェクト | バンド・ソロなどの名義 |
| person | 人物 | |
| composition | 楽曲 | 曲そのもの。録音や演奏を束ねる単位 |
| recording | バージョン | 楽曲の個々の録音（スタジオ/ライブ/デモ…）。サイト上で「録音」とは言わない |
| work | 作品 | アルバム・シングルなどのまとまり |
| release | 版 | 作品の具体的な出し方（初回盤 / 再発 / 配信など）。独立ページにしない |
| track | （表記なし） | 作品ページのトラックリストの行 |
| event | ライブ | |
| event_performance | セットリスト | |
| venue | 会場 | |
| composition_credit / contribution | クレジット | |
| label | レーベル | |
| distributor | 流通 | |
| publication / publication_issue / article | 媒体 / 号 / 記事 | 資料室 |

**閲覧者に work / release / discography の3概念を見せない。** DB上は work（抽象作品）と release（具体的な出し方）が分かれているが、閲覧者にとってその違いは判別しづらい。公開UIは **ディスコグラフィ一覧 → 作品ページ の2段**に統合する。release は独立ページを持たせず、作品ページ内のセクション（「版」、アンカー `#edition-<slug>`）として表現する。

### 3.2 ルート一覧

| path | 画面名 | 主データ（テーブル） |
|---|---|---|
| `/` | ホーム | 全域の集約 + ランダム |
| `/timeline` | 年表 | release, event, membership, project |
| `/projects` | プロジェクト一覧 | project |
| `/projects/:slug` | プロジェクト詳細 | project, membership(+role/instrument), work, release, event |
| `/people` | 人物一覧 | person, membership, contribution |
| `/people/:slug` | 人物詳細 | person, membership(+membership_role), contribution, composition_credit |
| `/discography` | ディスコグラフィ一覧 | work, work_project, release, label_relation |
| `/discography/:slug` | 作品詳細（版セクション含む） | work, work_project, release, label_relation, track |
| `/songs` | 楽曲一覧 | composition, recording, event_performance |
| `/songs/:slug` | 楽曲詳細 | composition, composition_credit, recording, track, release, event_performance |
| `/lives` | ライブ一覧 | event, venue, project |
| `/lives/:slug` | ライブ詳細 | event, event_performance, composition, venue, contribution |
| `/venues` | 会場一覧 | venue, event |
| `/venues/:slug` | 会場詳細 | venue, event, event_performance |
| `/network` | 人物相関 | person, membership, project |
| `/library` | 資料室 | publication, publication_issue, article |
| `/about` | About | 静的 + 件数集計 |

`/works/:id` と `/releases/:id` は廃止し、`/discography` と `/discography/:slug` に統合した（理由は §3.1）。

### 3.3 slug 方針

公開URLに uuid は使わない。すべて人間可読な slug にする。

- **project / person / composition / work / venue**: DB に `slug` text 列（unique, 当面 nullable）を追加する（§10）。生成はパイプライン側 — 英字タイトルは kebab-case、日本語はヘボン式ローマ字化の初期案を機械生成し**人手レビューで確定**する（compositions の draft レビュー文化と同じ流儀）。例: 黄金の鐘 → `ougon-no-kane`、ANALYZE → `analyze`。
- **event**: `YYYY-MM-DD-<venue-slug>` の合成 slug。`(project_id, venue_id, event_date)` の unique 制約により決定的に生成できる。同日衝突時は `-2` の連番を振る。DB に `slug` 列を持たせ、パイプラインが埋める。
- 衝突時は共通して `-2` サフィックスを振る。**一度公開した slug は変更しない**。変更が必要な場合は旧 slug から静的リダイレクトページを生成する。

### 3.4 リンク関係（回遊グラフ）

```mermaid
graph LR
  Home["/"] --> Timeline["/timeline"]
  Home --> Project["/projects/:slug"]
  Home --> Song["/songs/:slug"]
  Home --> Live["/lives/:slug"]
  Timeline --> Project & Discography["作品 /discography/:slug"] & Live
  Project --> Person["/people/:slug"] & Discography & Live & Song
  Discography --> Song & Person
  Song --> Discography & Live & Person
  Live --> Song & Venue["/venues/:slug"] & Person & Project
  Venue --> Live
  Person --> Project & Discography & Live & Song & Network["/network"]
  Network --> Person & Project
  Library["/library"] -.将来: mention.-> Person & Discography & Live
```

**リンク規約**: 画面上に現れるエンティティ名（人物・プロジェクト・楽曲・作品・会場）は例外なくリンクにする。各詳細画面の末尾に「つながり」セクションを置き、隣接エンティティへの導線を必ず 2 系統以上確保する（例: 楽曲詳細 → 収録作品群 + 演奏されたライブ群）。行き止まりページを作らない。

## 4. 画面別仕様

各画面: 目的 / コンテンツブロック（上から順） / データと計算 / 空データ時の扱い。

### 4.1 `/` ホーム — 「アーカイブの入口と、今日の偶然」

- **キャリアリバー**（ヒーロー）: 1994–現在の横軸に 8 プロジェクトの活動期間を帯で描く。帯はプロジェクトカラー（§7.3）。クリックでプロジェクト詳細へ。これがサイトの「地図」であり、以後全画面のプロジェクトカラーの意味をここで学習させる。
- **数字タイル**: 楽曲 218 / 作品 64 / ライブ 395 / 人物 112 / 会場 156 / 記事 350（ビルド時に DB から集計し JSON に埋め込んだものを描画、tabular-nums）。各タイルは一覧画面へのリンク（作品のタイルは `/discography` へ）。
- **今日の発見（Dig カード ×3）**: ビルド時に生成する Dig インデックス JSON（全エンティティの slug + 種別 + 一言）から、クライアント JS がランダムに (a) ある日のセットリスト（event 1件 + 演奏曲数）、(b) ある曲の旅（複数録音 or 複数版に収録の composition）、(c) ある会場の歴史（公演数上位からランダム）を選び描画する。再抽選ボタンで表示中のページ内で候補を引き直せる。
- **この日なんの日**: MM-DD をキーにしたビルド時生成 JSON をクライアントで参照し、今日と同じ月日の過去イベント・リリースを表示する。該当なしの日はブロック自体を出さない。
- 未来のイベント（eventDate >= today、2026年に6件存在）があれば最上部に「予定」バナー。

### 4.2 `/timeline` 年表 — 「30年を1本のスクロールに」

- 縦スクロールの統合年表。年見出しごとに: 発売（◆ + 作品タイトル、format chip。release 単位）、ライブ（月単位に集約したカウント + 主要公演。全395件を個別に並べると2006–2007年が破綻するため「n本」集約 + 展開）、メンバー加入・脱退（membership の from/to）、プロジェクト開始・終了。
- 左端にプロジェクトカラーの帯を通し、どの名義の時代かを常時可視化。
- フィルタ: プロジェクト（複数選択）、種別（発売 / ライブ / 人事）。URL クエリで状態保持する。**URLを直接開いた際に完全に状態復帰できることを受け入れ基準とする**（SSGのためフィルタは client island として実装し、初期化時にURLクエリを読んで状態を復元する。実装後に直リンクでの復帰をE2Eで確認する）。この受け入れ基準は /lives・/discography など、フィルタを持つ全画面に適用する。
- 日付精度（`releaseDatePrecision` 等）に従い「1999年」「1999年3月」「1999年3月10日」を出し分ける（§8）。
- 年・月のすべての日付セクション見出しに安定したアンカーid（例 `#y1999`, `#y1999-03`）を付与し、見出しホバー（モバイルではタップ）でアンカーリンクをコピーできる。すべての日付セクションがユニークURLで直接開ける。

### 4.3 `/projects/:slug` プロジェクト詳細 — 「ひとつの名義の全体像」

- ヘッダ: 名前 / type / 活動期間 / description。プロジェクトカラーをヘッダ罫線に使用。
- **メンバー在籍図（Gantt）**: membership の fromDate–toDate を人物ごとの横棒で。`support = true` は破線・薄色。membership_role から役割・楽器をツールチップ表示。人物名 → `/people/:slug`。
- ディスコグラフィ: work（type: original/best/live/compilation でグループ）ごとに `/discography/:slug` 作品ページへのリンク一覧。個々の release への直接リンクは持たない（版は作品ページ内のセクション）。
- ライブ活動: 年別本数の棒グラフ + 会場上位5 + 全公演リストへのリンク（`/lives?project=`）。
- **よく演奏された曲 Top 10**: event_performance を project の event で絞って集計。→ `/songs/:slug`。

### 4.4 `/people/:slug` 人物詳細 — 「この人はどこで門田と交差したか」

- ヘッダ: 名前 / description / 活動期間（**person.activeFrom/To は全件 NULL のため、membership と contribution の最小日〜最大日から導出**）。
- **所属タイムライン**: 複数プロジェクトへの在籍を 1 本の横軸に重ねて表示（兼任・移籍が一目でわかる。伊藤大地・内田武瑠で最も映える画面）。
- 役割サマリ: contribution を role.category ごとに集計したチップ群（performer 75回 / recording_engineer 12回 など）。
- 作った曲: composition_credit（composer / lyricist 別）。曲名 → `/songs/:slug`。
- 関与一覧: contribution を対象別タブ（リリース / ライブ / 録音）で。※ recordingId を使う contribution は現状ほぼ無い → タブは件数 0 なら非表示。
- **共演者**: 同じプロジェクトに在籍期間が重なる人物、または同じ event に contribution した人物の上位。→ 回遊の要。

### 4.5 `/discography` + `/discography/:slug` 作品

- `/discography` 一覧: **大判ジャケットグリッドが主役**。ジャケットは正方形もジュエルケース型等の長方形もあるため、実画像の縦横比（artworkWidth/Height）を保って表示し、無理に正方形に切り抜かない。画像が無い作品は従来案のタイポグラフィックカード（タイトル + 年 + format chip + catalog#）にフォールバックする。フィルタ（プロジェクト / format / 年代 / editionType）とURL状態復帰は §4.2 の基準に従う。work_project の `participant` はコンピレーション参加として区別表示。
- `/discography/:slug` 作品ページ: ヘッダに大きめのジャケット + work情報（description / type / releasedDate）。**トラックリスト**（dotted leader、LP ジャケ裏風、初版基準）が主役で、`曲名 …… recording の versionName / type バッジ`。曲名 → `/songs/:slug`。クレジット（contribution where releaseId、role 別グループ）。
  - **版セクション**: その作品の全 release（初回盤 / 再発 / 配信）を時系列に並べ、それぞれに `#edition-<slug>` アンカーを付与して列挙する。catalogNumber・label・distributor・発売日（精度対応）・版ごとの収録差分（trackが異なる場合のみ差分表示）・`reissueOfReleaseId` による再発系譜を版セクション内で双方向リンクする。
- **ジャケット画像の仕組み**: 画像ファイルは admin UI からアップロードして Cloudflare R2 に保存し、その URL を DB に保存する運用にする。DB拡張（§10参照）: `release` に `artworkUrl` / `artworkWidth` / `artworkHeight` 列を追加。作品の代表ジャケットは主たる版（初版）のものを使う。

### 4.6 `/songs` + `/songs/:slug` 楽曲 — 発見機能の中核画面

- `/songs` 一覧: タイトル / 作曲・作詞者 / 録音数 / 収録作品数 / 演奏回数 / 初出年。ソート可能（「演奏回数順」が最初の発見装置になる）。
- `/songs/:slug` 詳細:
  - クレジット（composition_credit、orderIndex 順）。
  - **録音バージョン一覧**: recording を type バッジ（studio / live / demo / rehearsal / other）+ versionName で。各バージョンの収録先を紐付け表示し、作品ページの該当版アンカー（`/discography/:slug#edition-<slug>`）へリンクする。**recordingYear は全件 NULL のため、年は初出リリースの releaseDate で代替**。
  - **曲の旅（収録史）**: この曲を収録した全ての版を時系列に並べ、それぞれ作品ページの該当版アンカーへリンクする。プロジェクトカラーで名義を示す。「ANALYZE」なら 7 つの版・名義を跨ぐ旅が 1 本の線で見える。
  - **演奏史**: event_performance から (a) 初演 / 最終演奏、(b) 総演奏回数とアンコール率、(c) 年別演奏回数のヒートストリップ（1999–2026 の横帯）、(d) **「◯年ぶり」ギャップバッジ** — 演奏日の間隔が 3 年以上空いた復活演奏を自動検出して明示。これがこの画面最大の発見装置。
  - 録音 0 件の曲（30曲存在）は「ライブでのみ演奏された曲」として演奏史のみで成立させる。

### 4.7 `/lives` + `/lives/:slug` + `/venues/:slug`

- `/lives`: 年セレクタ（年別件数付き）+ プロジェクト / 会場フィルタ + リスト（日付 / イベント名 / 会場 / 演奏曲数）。フィルタとURL状態復帰は §4.2 の基準に従う。
- `/lives/:slug`: セットリスト（orderIndex 順、encore は罫線で区切り「アンコール」見出し）。**variationNote がある行はそれを主表記とし、補足として元の楽曲名を小さく添える**（例: 主表記「ミナソコ (weakened ver.)」/ 補足「ミナソコ」。リンクは元の楽曲ページ `/songs/:slug` へ）。サポートメンバー（contribution where eventId）。会場リンク。**前後の公演ナビ**（同プロジェクトの直前・直後の event）で年表的に歩ける。startTime / ticketPrice はほぼ NULL のため、値がある時のみ表示。
- `/venues/:slug`: 公演履歴（年別 + プロジェクト内訳）、**この会場での定番曲**（event_performance 集計 Top 5）。孤立 venue 8 件は「記録上の公演なし」と正直に表示。

### 4.8 `/network` 人物相関 — 「彷徨う」ためのビジュアル

- person × project の二部グラフ。中央にプロジェクト 8 ノード（プロジェクトカラー）、周囲に人物ノード。2 プロジェクト以上に在籍する人物（10人）を強調し、1 プロジェクトのみの人物は初期状態で薄く。エッジは membership（support は破線）。
- 実装は d3-force か手書き SVG レイアウトで十分（ノード数 ~120）。ホバーで当該人物の全エッジをハイライト、クリックで `/people/:slug`。
- トグル: サポートメンバーを含む / 除く。

**拡張ロードマップ（初期リリース後）**:

- 将来像: 門田と関わった人物が他にやっているバンド、さらにそのバンドのメンバーのバンド…と辿れる相関図へ拡張する。
- DB拡張（§10参照）: `project` に `scope` text 列（`'monden' | 'external'`、default `'monden'`）を追加する。外部バンドも同じ project テーブル + membership 構造に載せるため、グラフ探索・在籍期間・役割の既存ロジックがそのまま使える。既存の門田名義クエリは `scope = 'monden'` でフィルタする。
- UI: 初期表示は現行の門田プロジェクト中心の depth 1。人物ノードをクリックすると外部プロジェクトが展開される段階的探索（初期ロードは depth 2 まで、以降はクリック展開）。外部プロジェクトはプロジェクトカラーを持たず muted なグレー系スタイルで区別する。
- データ投入ガイドライン: スコープ爆発を防ぐため「**門田と直接在籍が重なった or 共演（contribution共起）した人物の、主要な他バンドに限る**」。rawData には外部バンド情報がほぼ無いため、新規のリサーチ・手入力領域であり admin UI の編集対象とする。実装は P3 以降。

### 4.9 `/library` 資料室

- publication（97誌）→ publication_issue（335号）→ article（350件）の階層ブラウズ + 記事タイトル横断検索（Pagefind、§2参照）。
- **article_mention_\* は 3 テーブルとも 0 件**のため、現段階では独立したアーカイブとして提示し、エンティティへの相互リンクは「将来拡張」と設計書上も UI 上も明示する（実装エージェントはリンク UI を作らないこと）。content / url / publishedDate は NULL が 40–60% ある → ある項目だけ描画。

### 4.10 `/about`

§6 の掲載文 + データ提供元の説明 + 件数フッター（ビルド時に DB から集計、「2026年7月時点」のような static な文言は書かない）+ リポジトリへの言及。

## 5. 横断ディスカバリー機能

| 機能 | 置き場所 | 実装 |
|---|---|---|
| **Dig（ランダム到達）** | ヘッダ常設ボタン | ビルド時生成の Dig インデックス JSON（song/live/person/work の slug + 種別 + 一言）からクライアントJSがランダムに1件を選び遷移。「調べる」導線と対になる「彷徨う」導線 |
| ◯年ぶり演奏バッジ | 楽曲詳細・ライブ詳細 | event_performance の日付間隔 ≥3年 を export 時に計算し JSON へ埋め込む |
| 曲の旅 | 楽曲詳細 | track → release → work を時系列連結し、作品ページの版アンカーへリンク |
| この日なんの日 | ホーム | 月日一致をビルド時に事前計算した JSON |
| 再発系譜 | 作品ページ（版セクション） | reissueOfReleaseId の双方向表示 |
| 共演者 | 人物詳細 | membership 期間重複 + event 共起 |
| 前後の公演ナビ | ライブ詳細 | 同 project の隣接 event |
| 定番曲 | 会場詳細・プロジェクト詳細 | event_performance 集計 |

## 6. About ページ掲載文（このまま使用可）

> **このサイトについて**
>
> 門田匡陽データベースは、音楽家・門田匡陽の活動を記録する非公式のファンメイド・アーカイブです。sweet girls、サンチェスター・ユナイテッドFC、BURGER NUDS、Good Dog Happy Men、ソロ名義、Poet-type.M——名義を変えながら続いてきた30年あまりの活動を、リリース・楽曲・ライブ・そして関わった人々のつながりとして正規化されたデータベースに収め、横断して辿れるようにしています。
>
> 名義が変わっても、曲は旅を続けます。あるバンドの解散をまたいで再録される曲があり、十数年ぶりにステージへ戻ってくる曲がある。同じ音楽家たちが、別のプロジェクトで何度も合流する。このアーカイブが大切にしているのは、個々の記録の正確さと同時に、そうした「点と点のあいだの線」を見えるようにすることです。
>
> 収録データは雑誌記事・フライヤー・当時のウェブサイトなどの資料から人手のレビューを経て整理したものですが、日付の精度が年単位に留まるもの、出典を確認しきれていないものも含みます。記録の欠けや誤りにお気づきの際は、ご指摘・情報提供をいただけると嬉しいです。

## 7. トンマナ

**コンセプト: 「深夜のライブハウスと、翌朝の紙資料」** — ダークテーマはライブハウスの暗がりにスポットライトの琥珀、ライトテーマはフライヤーや音楽誌の複写を思わせるクールな紙白にインク。生成り紙 + テラコッタのような既視感のある「アーカイブ風」は避ける。装飾は抑制し、タイポグラフィと罫線とプロジェクトカラーだけで組む。

### 7.1 カラートークン

| token | light | dark | 用途 |
|---|---|---|---|
| `--ground` | `#F5F5F1` | `#15171C` | 背景（dark は藍がかった黒） |
| `--surface` | `#FFFFFF` | `#1D2027` | カード・表 |
| `--ink` | `#1C1E22` | `#E8E6DF` | 本文 |
| `--ink-muted` | `#5C5F66` | `#9A9CA3` | 補足・メタ情報 |
| `--rule` | `#D8D8D2` | `#2E323B` | 罫線 |
| `--accent` | `#9A6B1F` | `#D9A441` | リンク・強調（スポットライトの琥珀） |
| `--accent-ink` | `#FFFFFF` | `#15171C` | accent 上の文字 |

`prefers-color-scheme` をデフォルトに、`:root[data-theme]` で上書きするトークン方式。両テーマとも AA コントラストを維持。

### 7.2 タイポグラフィ

| 役割 | 書体 | 備考 |
|---|---|---|
| 見出し・エンティティ名 | **Shippori Mincho B1**（@fontsource で同梱） | 詩人性・資料性。ウェイト 600/700 |
| 本文・UI | system sans（Hiragino Kaku Gothic / Noto Sans JP fallback） | 15px 基準、行間 1.8 |
| 日付・catalog# ・数値 | **IBM Plex Mono** または system mono、`tabular-nums` | セットリスト番号・年表の軸 |

型スケール: 12 / 13 / 15 / 18 / 24 / 34px。見出しは `text-wrap: balance`。本文の測りは最大 65ch。英字ラベル（format chip 等）は uppercase + letter-spacing 0.06em。

### 7.3 プロジェクトカラー（8色、彩度抑えめの categorical）

| プロジェクト | hex |
|---|---|
| sweet girls | `#6B7F4F` |
| サンチェスター・ユナイテッドFC | `#B3823C` |
| BURGER NUDS | `#4A5D8A` |
| Good Dog Happy Men | `#6E5687` |
| 門田匡陽（2010–12） | `#3F7E70` |
| Poet-type.M | `#8C3A4B` |
| 門田匡陽（2020–） | `#2F6B4F` |
| その他の名義 | `#75757083` 相当のグレー `#757570` |

用途はタイムライン帯・バッジ・グラフのみ（本文リンクには使わない）。dark テーマでは各色を +12% 明度補正。

### 7.4 スペーシング / レイアウト

- 4px ベースグリッド。セクション間 48px、ブロック間 24px、行内 8px。
- コンテンツシェル最大 1200px。年表・Gantt・表は自身のコンテナで `overflow-x: auto`。
- 罫線は 1px 実線（`--rule`）を基本とし、角丸は 4px まで。カードに影は使わず罫線で区切る（紙資料の感覚）。

### 7.5 モーション

- 原則: **控えめ・一度きり・150–200ms ease-out**。ホバーはリンク下線 + accent 遷移のみ。
- 許可する演出: (1) 年表・Gantt 要素のスクロール時 fade + 8px slide（初回のみ）、(2) Dig ボタン押下時のカード差し替え crossfade 200ms、(3) network のホバーハイライト。
- 禁止: パララックス、無限ループアニメ、ページ遷移演出（遷移は即時）。`prefers-reduced-motion` で全て無効化。

### 7.6 スマートフォン / レスポンシブ方針

- モバイルファーストで実装する。ブレークポイント: 〜640px（1カラム）/ 640–1024px（2カラム可）/ 1024px〜（フルレイアウト、シェル最大1200px）。
- 横長の可視化はモバイルで形を変える: **キャリアリバーは縦タイムライン化**する（プロジェクト帯を縦に並べる）。**メンバーGanttは人物ごとの行リスト + 小さな期間バー**に変える。年別ヒートストリップとトラックリストはコンテナ横スクロールを容認する（開始位置を最新側に制御しスクロールヒントを表示）。network はピンチズーム可能にし、代替として同内容のリスト表示を併設する。
- hover 依存を禁止する: ツールチップ・アンカーリンク表示はタップで開閉できるようにする。タップターゲットは最小44px。
- 型スケールはモバイルで一段縮小する（34→28、24→20）。本文15pxは維持。
- テーブルは横スクロール or 縦積み（definition list 化）を画面ごとに選択し、§4の各画面仕様に従う。

## 8. データ粗密と表示ルール（実装エージェント必読）

| 事実 | 表示ルール |
|---|---|
| `article_mention_*` 3 テーブルとも 0 件 | /library はエンティティリンクなしの独立アーカイブとして実装 |
| `person.activeFrom/To/deathDate` 全件 NULL | 人物の活動期間は membership + contribution から導出 |
| `recording.recordingYear` 全件 NULL、`recordedDate` もほぼ NULL | 録音の年は初出リリース releaseDate で代替表示（「初出: 2004」） |
| `event.ticketPrice` 全件 NULL、`startTime` 87% NULL | 値がある場合のみ行を描画。空欄プレースホルダを並べない |
| `article.content` 41% / `url` 60% NULL | 同上 |
| 日付精度カラム（`releaseDatePrecision`, `fromDatePrecision` 等） | 共有コンポーネント `DateText` が精度に応じ「1999年」「1999年3月」「1999年3月10日」を出し分け。精度を偽らない |
| 録音 0 件の composition が 30 曲 | 「ライブ演奏のみ」バッジで正規に扱う（欠損ではない） |
| 未来の event（2026 年に予定あり） | 「予定」バッジ。セットリスト空でも正常 |
| venue に表記ゆれ疑い（例: 新代田FEVER）・孤立 venue 8 件 | サイト側で名寄せしない。データ修正はパイプライン側の課題として別 issue |
| track 0 件の release が 2 件 | 「収録曲情報未登録」の 1 行を表示 |

## 9. 実装フェーズ提案

1. **P0（前提）**: DB拡張マイグレーション（§10）+ slug 充足パイプライン（機械生成 → 人手レビュー）+ ジャケットアップロード機構（admin側、R2アップロード + `release.artworkUrl` 等の保存）。
2. **P1 骨格**: `site/` の Astro プロジェクト立ち上げ + export スクリプト（DB → JSON）+ 主要一覧・詳細ページ（projects / people / discography / songs / lives / venues）でリンク規約（§3.4）を完成させる + Cloudflare デプロイ導線（wrangler deploy）。
3. **P2 発見装置**: ホーム（キャリアリバー + Dig island）、/timeline（フィルタ island + アンカー）、楽曲詳細の演奏史・曲の旅、◯年ぶりバッジ。
4. **P3 仕上げ**: /network（拡張基盤含む）、/library、/about、モバイル微調整、Pagefind 検索。

各フェーズ末に `bun run typecheck` / `bun test` / 実画面のスクリーンショット確認 + **フィルタ付き画面のURL直開き復帰確認** を通すこと。

## 10. DB拡張ロードマップ

本サイトのために `app/db/schema.ts` へ加える拡張の一覧（マイグレーション適用は別作業。schema.ts がスキーマの唯一の情報源である原則は不変）。

1. **slug 列**: `project` / `person` / `composition` / `work` / `venue` に `slug text unique`（当面 nullable、パイプライン生成 + 人手レビューで順次充足）。`event` は `(project_id, venue_id, event_date)` から決定的に生成する合成 slug を同じく `slug` 列に保持する。
   目的: 公開URLからuuidを排除するため（§3.3 / c_67dcc3）。
2. **ジャケット**: `release.artworkUrl text` / `artworkWidth integer` / `artworkHeight integer`（Cloudflare R2 のURL。admin UIからアップロード・登録）。
   目的: /discography のジャケットグリッドと作品ページのヘッダ画像のため（§4.5 / c_bcdec2）。
3. **相関図拡張**: `project.scope text NOT NULL default 'monden'`（`'monden' | 'external'` の CHECK 付き）。
   目的: /network を外部バンドまで辿れる相関図に拡張するため（§4.8 / c_794b1d）。
