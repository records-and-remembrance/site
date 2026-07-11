# 門田匡陽データベース 閲覧サイト設計書

status: draft（レビュー待ち）
audience: レビュー後にこのサイトを実装するエージェント / 人間レビュアー
data source: ローカル PostgreSQL（`postgres://monden:monden@localhost:5432/monden`、read-only）
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

既存の admin アプリの規約（`routes.ts` + `repository.ts` + `types.ts`、React 19 + Vite + TanStack Query）を踏襲する。**読み取り専用**。

```
app/site/                  # Hono API（/api/site 配下に app/server.ts でマウント）
  routes.ts                # エンドポイント定義
  repository.ts            # read-only クエリ（Drizzle）
  types.ts                 # API レスポンス型
  routes.test.ts
app/site-client/           # Vite React クライアント（:5174、/api を :3000 にプロキシ）
  index.html
  vite.config.ts
  src/
    main.tsx / App.tsx / router.tsx
    theme/tokens.css       # §7 のデザイントークン
    components/<screen>/   # 画面ごとに UI + api.ts + state + テスト同梱（admin-client と同じ構成）
    components/shared/     # EntityLink, DateText(精度対応), TimelineBand, StatTile 等
```

package.json に追加するスクリプト: `site:client`（Vite :5174）、`site:dev`（admin:server + site:client 並行）、`site:build`（→ dist/site）。

API 設計方針: 画面 1 つにつき集約エンドポイント 1 本（例 `GET /api/site/songs/:id` が楽曲+クレジット+録音+収録リリース+演奏履歴をまとめて返す）。N+1 をクライアントに持ち込まない。ランダム系は `GET /api/site/dig`（後述）。

## 3. 情報アーキテクチャ

### 3.1 ルート一覧

| path | 画面名 | 主データ（テーブル） |
|---|---|---|
| `/` | ホーム | 全域の集約 + ランダム |
| `/timeline` | 年表 | release, event, membership, project |
| `/projects` | プロジェクト一覧 | project |
| `/projects/:id` | プロジェクト詳細 | project, membership(+role/instrument), work, release, event |
| `/people` | 人物一覧 | person, membership, contribution |
| `/people/:id` | 人物詳細 | person, membership(+membership_role), contribution, composition_credit |
| `/discography` | ディスコグラフィ | work, work_project, release, label_relation |
| `/works/:id` | 作品詳細 | work, work_project, release |
| `/releases/:id` | リリース詳細 | release, track, recording, composition, label, distributor, contribution |
| `/songs` | 楽曲一覧 | composition, recording, event_performance |
| `/songs/:id` | 楽曲詳細 | composition, composition_credit, recording, track, release, event_performance |
| `/lives` | ライブ一覧 | event, venue, project |
| `/lives/:id` | ライブ詳細 | event, event_performance, composition, venue, contribution |
| `/venues` | 会場一覧 | venue, event |
| `/venues/:id` | 会場詳細 | venue, event, event_performance |
| `/network` | 人物相関 | person, membership, project |
| `/library` | 資料室 | publication, publication_issue, article |
| `/about` | About | 静的 + 件数集計 |

ID は DB の uuid をそのまま使う（slug 生成はしない。エージェント実装が単純になり、名寄せ問題を避けられる）。

### 3.2 リンク関係（回遊グラフ）

```mermaid
graph LR
  Home["/"] --> Timeline["/timeline"]
  Home --> Project["/projects/:id"]
  Home --> Song["/songs/:id"]
  Home --> Live["/lives/:id"]
  Timeline --> Project & Release["/releases/:id"] & Live
  Project --> Person["/people/:id"] & Work["/works/:id"] & Live & Song
  Work --> Release
  Release --> Song & Person & Work
  Song --> Release & Live & Person
  Live --> Song & Venue["/venues/:id"] & Person & Project
  Venue --> Live
  Person --> Project & Release & Live & Song & Network["/network"]
  Network --> Person & Project
  Library["/library"] -.将来: mention.-> Person & Work & Live
```

**リンク規約**: 画面上に現れるエンティティ名（人物・プロジェクト・楽曲・リリース・会場）は例外なくリンクにする。各詳細画面の末尾に「つながり」セクションを置き、隣接エンティティへの導線を必ず 2 系統以上確保する（例: 楽曲詳細 → 収録リリース群 + 演奏されたライブ群）。行き止まりページを作らない。

## 4. 画面別仕様

各画面: 目的 / コンテンツブロック（上から順） / データと計算 / 空データ時の扱い。

### 4.1 `/` ホーム — 「アーカイブの入口と、今日の偶然」

- **キャリアリバー**（ヒーロー）: 1994–現在の横軸に 8 プロジェクトの活動期間を帯で描く。帯はプロジェクトカラー（§7.3）。クリックでプロジェクト詳細へ。これがサイトの「地図」であり、以後全画面のプロジェクトカラーの意味をここで学習させる。
- **数字タイル**: 楽曲 218 / リリース 68 / ライブ 395 / 人物 112 / 会場 156 / 記事 350（DB から動的集計、tabular-nums）。各タイルは一覧画面へのリンク。
- **今日の発見（Dig カード ×3）**: `GET /api/site/dig` がランダムに返す (a) ある日のセットリスト（event 1件 + 演奏曲数）、(b) ある曲の旅（複数録音 or 複数リリース収録の composition）、(c) ある会場の歴史（公演数上位からランダム）。リロードごとに変わる。
- **この日なんの日**: 今日と同じ月日の過去イベント・リリース（`to_char(event_date,'MM-DD')` 一致）。該当なしの日はブロック自体を出さない。
- 未来のイベント（eventDate >= today、2026年に6件存在）があれば最上部に「予定」バナー。

### 4.2 `/timeline` 年表 — 「30年を1本のスクロールに」

- 縦スクロールの統合年表。年見出しごとに: リリース（◆ + タイトル、format chip）、ライブ（月単位に集約したカウント + 主要公演。全395件を個別に並べると2006–2007年が破綻するため「n本」集約 + 展開）、メンバー加入・脱退（membership の from/to）、プロジェクト開始・終了。
- 左端にプロジェクトカラーの帯を通し、どの名義の時代かを常時可視化。
- フィルタ: プロジェクト（複数選択）、種別（リリース / ライブ / 人事）。URL クエリで状態保持（nuqs、admin-client と同じ）。
- 日付精度（`releaseDatePrecision` 等）に従い「1999年」「1999年3月」「1999年3月10日」を出し分ける（§8）。

### 4.3 `/projects/:id` プロジェクト詳細 — 「ひとつの名義の全体像」

- ヘッダ: 名前 / type / 活動期間 / description。プロジェクトカラーをヘッダ罫線に使用。
- **メンバー在籍図（Gantt）**: membership の fromDate–toDate を人物ごとの横棒で。`support = true` は破線・薄色。membership_role から役割・楽器をツールチップ表示。人物名 → `/people/:id`。
- ディスコグラフィ: work（type: original/best/live/compilation でグループ）→ 配下 release。
- ライブ活動: 年別本数の棒グラフ + 会場上位5 + 全公演リストへのリンク（`/lives?project=`）。
- **よく演奏された曲 Top 10**: event_performance を project の event で絞って集計。→ `/songs/:id`。

### 4.4 `/people/:id` 人物詳細 — 「この人はどこで門田と交差したか」

- ヘッダ: 名前 / description / 活動期間（**person.activeFrom/To は全件 NULL のため、membership と contribution の最小日〜最大日から導出**）。
- **所属タイムライン**: 複数プロジェクトへの在籍を 1 本の横軸に重ねて表示（兼任・移籍が一目でわかる。伊藤大地・内田武瑠で最も映える画面）。
- 役割サマリ: contribution を role.category ごとに集計したチップ群（performer 75回 / recording_engineer 12回 など）。
- 作った曲: composition_credit（composer / lyricist 別）。
- 関与一覧: contribution を対象別タブ（リリース / ライブ / 録音）で。※ recordingId を使う contribution は現状ほぼ無い → タブは件数 0 なら非表示。
- **共演者**: 同じプロジェクトに在籍期間が重なる人物、または同じ event に contribution した人物の上位。→ 回遊の要。

### 4.5 `/discography` + `/works/:id` + `/releases/:id`

- `/discography`: work 単位のタイポグラフィックカードのグリッド（ジャケット画像は無いため、タイトル + 年 + format chip + catalog# をカードのデザイン要素として扱う）。フィルタ: プロジェクト / format / 年代 / editionType。work_project の `participant` はコンピレーション参加として区別表示。
- `/works/:id`: work の説明 + type + 配下の全 release（初版と reissue を系譜表示）。
- `/releases/:id`: **トラックリストが主役**。track_number 順に dotted leader（LP ジャケ裏風）で `曲名 …… recording の versionName / type バッジ`。曲名 → `/songs/:id`。クレジット（contribution where releaseId、role 別グループ）。label / distributor / catalogNumber / 発売日（精度対応）。`reissueOfReleaseId` があれば「このリリースは◯◯の再発」リンク、逆方向（再発盤一覧）も表示。

### 4.6 `/songs` + `/songs/:id` 楽曲 — 発見機能の中核画面

- `/songs` 一覧: タイトル / 作曲・作詞者 / 録音数 / 収録リリース数 / 演奏回数 / 初出年。ソート可能（「演奏回数順」が最初の発見装置になる）。
- `/songs/:id` 詳細:
  - クレジット（composition_credit、orderIndex 順）。
  - **録音バージョン一覧**: recording を type バッジ（studio / live / demo / rehearsal / other）+ versionName で。各録音の収録先リリース（track 経由）を紐付け表示。**recordingYear は全件 NULL のため、年は初出リリースの releaseDate で代替**。
  - **曲の旅（収録史）**: この曲を収録した全リリースを時系列に並べ、プロジェクトカラーで名義を示す。「ANALYZE」なら 7 リリース・名義を跨ぐ旅が 1 本の線で見える。
  - **演奏史**: event_performance から (a) 初演 / 最終演奏、(b) 総演奏回数とアンコール率、(c) 年別演奏回数のヒートストリップ（1999–2026 の横帯）、(d) **「◯年ぶり」ギャップバッジ** — 演奏日の間隔が 3 年以上空いた復活演奏を自動検出して明示。これがこの画面最大の発見装置。
  - 録音 0 件の曲（30曲存在）は「ライブでのみ演奏された曲」として演奏史のみで成立させる。

### 4.7 `/lives` + `/lives/:id` + `/venues/:id`

- `/lives`: 年セレクタ（年別件数付き）+ プロジェクト / 会場フィルタ + リスト（日付 / イベント名 / 会場 / 演奏曲数）。
- `/lives/:id`: セットリスト（orderIndex 順、encore は罫線で区切り「アンコール」見出し、variationNote 併記）。曲名 → `/songs/:id`。サポートメンバー（contribution where eventId）。会場リンク。**前後の公演ナビ**（同プロジェクトの直前・直後の event）で年表的に歩ける。startTime / ticketPrice はほぼ NULL のため、値がある時のみ表示。
- `/venues/:id`: 公演履歴（年別 + プロジェクト内訳）、**この会場での定番曲**（event_performance 集計 Top 5）。孤立 venue 8 件は「記録上の公演なし」と正直に表示。

### 4.8 `/network` 人物相関 — 「彷徨う」ためのビジュアル

- person × project の二部グラフ。中央にプロジェクト 8 ノード（プロジェクトカラー）、周囲に人物ノード。2 プロジェクト以上に在籍する人物（10人）を強調し、1 プロジェクトのみの人物は初期状態で薄く。エッジは membership（support は破線）。
- 実装は d3-force か手書き SVG レイアウトで十分（ノード数 ~120）。ホバーで当該人物の全エッジをハイライト、クリックで `/people/:id`。
- トグル: サポートメンバーを含む / 除く。

### 4.9 `/library` 資料室

- publication（97誌）→ publication_issue（335号）→ article（350件）の階層ブラウズ + 記事タイトル横断検索。
- **article_mention_\* は 3 テーブルとも 0 件**のため、現段階では独立したアーカイブとして提示し、エンティティへの相互リンクは「将来拡張」と設計書上も UI 上も明示する（実装エージェントはリンク UI を作らないこと）。content / url / publishedDate は NULL が 40–60% ある → ある項目だけ描画。

### 4.10 `/about`

§6 の掲載文 + データ提供元の説明 + 件数フッター（DB から動的集計、「2026年7月時点」のような static な文言は書かない）+ リポジトリへの言及。

## 5. 横断ディスカバリー機能

| 機能 | 置き場所 | 実装 |
|---|---|---|
| **Dig（ランダム到達）** | ヘッダ常設ボタン | `GET /api/site/dig?type=` が song/live/person/release からランダム 1 件の詳細 URL を返す。「調べる」導線と対になる「彷徨う」導線 |
| ◯年ぶり演奏バッジ | 楽曲詳細・ライブ詳細 | event_performance の日付間隔 ≥3年 を検出 |
| 曲の旅 | 楽曲詳細 | track → release → work_project を時系列連結 |
| この日なんの日 | ホーム | 月日一致の event / release |
| 再発系譜 | リリース詳細 | reissueOfReleaseId の双方向表示 |
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

1. **P1 骨格**: `app/site` API + ルーティング + 共有コンポーネント（EntityLink / DateText / チップ類）+ 一覧・詳細の主要 6 画面（projects / people / discography+releases / songs / lives / venues）。プレーンなリストで良いのでリンク規約（§3.2）を完成させる。
2. **P2 発見装置**: ホーム（キャリアリバー + Dig）、/timeline、楽曲詳細の演奏史・曲の旅、◯年ぶりバッジ。
3. **P3 仕上げ**: /network、/library、/about、モーション、ダークテーマ微調整。

各フェーズ末に `bun run typecheck` / `bun test` / 実画面のスクリーンショット確認を通すこと。
