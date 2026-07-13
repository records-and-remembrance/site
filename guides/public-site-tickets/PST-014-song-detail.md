# PST-014 楽曲詳細の基本表示

- フェーズ: P2
- 対応箇所: 設計書 §3.2、§4.6
- 想定サイズ: マイグレーション1本相当
- 依存: PST-012、PST-013

## 目的

楽曲をクレジット、録音、収録版、ライブ演奏から確認できる詳細画面の基本を実装する。

## 実装範囲

- `/songs/:slug` のタイトルとcomposition_creditの順序付き表示。
- recordingのtype、versionName、versionDescription、初出release年。
- track→release→workの収録先と `#edition-<editionKey>` 版アンカーへのリンク。
- event_performanceの演奏一覧、event・project・venueへのリンク。
- 録音0件でも演奏史ブロックだけで成立する基本画面。

## テスト方針

- 作曲／作詞の順序、録音type、versionName NULL、収録版なしをfixtureテストする。
- 版アンカーとライブ詳細へのhrefが正しいことを契約テストする。録音の初出は、日付を持つ
  track→releaseの最小releaseDateを優先し、欠落時は年を捏造しない。
- live-only曲、演奏も録音もない空データ、variationNoteありを確認する。
- 詳細ページを複数slugで静的生成し、関連リンクの404を検出する。

## 受け入れ条件

- クレジットが種別とorderIndexを保って表示される。
- recordingの年はrecordingYearではなく初出releaseDateを優先ルールに従って表示する。
- 収録作品は作品ページの該当版アンカーへ遷移できる。
- event performanceからライブ詳細へ、ライブ側から楽曲へ相互に戻れる。
- 録音0件の曲で、録音セクションを欠損エラーにせず演奏情報を表示する。

## 対象外

曲の旅の時系列線、年別ヒートストリップ、復活演奏バッジ。
