# PST-012 作品詳細・版セクション

- フェーズ: P2
- 対応箇所: 設計書 §3.1、§3.2、§4.5
- 想定サイズ: マイグレーション1本相当
- 依存: PST-011

## 目的

workとreleaseの違いを内部に保ちつつ、閲覧者には一つの作品ページとして全版とトラックを見せる。

## 実装範囲

- `/discography/:slug` のworkヘッダ、代表ジャケット、description、type、releasedDate。
- 初版基準のトラックリスト、recordingのversionName/type、楽曲リンク。
- releaseごとの `#edition-<slug>` セクション、catalog、label、distributor、発売日精度。
- track差分がある場合だけ差分表示、`reissueOfReleaseId`の双方向リンク。
- release-level contributionのrole別表示。

## テスト方針

- 初版のみ、再発あり、track差分あり、track 0件のfixtureを先にテストする。
- edition anchor、曲リンク、再発元／再発先リンクをhref契約として検証する。
- track 0件では「収録曲情報未登録」を表示し、空のリストと混同しないことを確認する。
- releaseDatePrecisionとNULLメタデータの表示規則を共通基盤と結合して検証する。

## 受け入れ条件

- releaseを独立ページにせず、作品ページ内の版セクションへ集約する。
- `/discography/:slug#edition-<slug>` が直接開ける。
- トラック番号順に曲名と録音versionを表示し、曲名から楽曲詳細へ遷移できる。
- 再発系譜が元と再発の双方から辿れる。
- 版ごとに存在するlabel・distributorだけを表示する。

## 対象外

作品一覧のフィルタ、楽曲詳細の曲の旅、画像アップロード。
