# PST-016 ライブ詳細

- フェーズ: P2
- 対応箇所: 設計書 §3.2、§4.7
- 想定サイズ: マイグレーション1本相当
- 依存: PST-014、PST-015

## 目的

一公演のセットリストと周辺人物・会場・前後公演を、年表的に歩ける詳細画面にする。

## 実装範囲

- `/lives/:slug` のイベントヘッダ、日付、event名、project、venue。
- `orderIndex`順のセットリストとencore区切り。
- variationNoteを主表記、元のcomposition名を補足表示し、元曲へリンク。
- eventIdのcontribution、会場リンク、同projectの直前・直後event。
- startTime、ticketPriceの存在時のみ表示、予定event・空セットリスト。

## テスト方針

- 通常曲、variationNote、encore境界、support contribution、setlist 0件をfixtureテストする。
- 前後eventがない先頭・末尾と、同日衝突のslugを検証する。
- 主表記とリンク先が元compositionであることを契約テストする。
- モバイル幅でセットリストが横溢れせず、必要な場合だけコンテナスクロールすることを確認する。

## 受け入れ条件

- セットリストがorderIndex順で、encore開始時に「アンコール」を表示する。
- variationNoteがある行は主表記にvariationNote、補足に元曲名を表示する。
- 元曲、会場、人物、project、前後公演へ遷移できる。
- startTime・ticketPriceは値がある場合だけ表示される。
- 未来eventやセットリスト0件がエラーにならない。

## 対象外

会場別定番曲、楽曲詳細の演奏間隔分析、年表の全体フィルタ。
