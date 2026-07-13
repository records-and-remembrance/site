# PST-028 レスポンシブ・アクセシビリティ・性能

- フェーズ: P5
- 対応箇所: 設計書 §7.4〜7.6、§8
- 想定サイズ: マイグレーション1本相当
- 依存: PST-009〜PST-027

## 目的

主要画面をモバイル、キーボード、低速環境でも読めて操作できる状態へ仕上げる。

## 実装範囲

- 640px未満、640〜1024px、1024px以上のレイアウト調整。
- キャリアリバー、Gantt、networkのモバイル代替表示。
- 横スクロール領域の開始位置、スクロールヒント、44px操作領域。
- reduced-motion、focus、コントラスト、画像読み込み方針。LCP候補画像はlazy loadingしない、
  画面外画像は寸法を指定してlazy loadingする。
- 静的HTML、JS量、画像サイズ、CLSを確認する性能調整。静的画面へ不要なhydrateを追加せず、
  Pagefindとnetworkの初期bundleを他routeへ混入させない。

## テスト方針

- 主要routeのキーボード操作とアクセシビリティ検査を先に自動化する。
- 320px、640px、1024px、1440pxでスクリーンショットを比較する。
- reduced-motion、prefers-color-scheme、JS遅延を組み合わせて確認する。
- Lighthouse相当の性能計測で、画像の寸法・lazy loading・不要な初期JSを確認する。

## 受け入れ条件

- 主要画面が320px幅で横方向に全体崩壊せず、必要な表だけ局所スクロールする。
- hoverなしでもtooltip相当情報、アンカーコピー、network操作が使える。
- すべてのinteractive要素にfocus表示と44px以上のタップ領域がある。
- reduced-motionで許可演出が停止し、本文コントラストがlight/dark双方でAA相当になる。
- `<img>` にwidth/heightと必要なlazy loadingがあり、CLSを抑制する。
- 計測対象route・端末条件・JS/画像/CLSの上限値をリリース記録に先に固定し、測定結果とともに
  残す。

## 対象外

新しい画面機能、データ修正、デザインコンセプトの変更。
