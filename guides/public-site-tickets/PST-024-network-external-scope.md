# PST-024 外部scopeの入力・段階展開

- フェーズ: P4
- 対応箇所: 設計書 §4.8、§10-3
- 想定サイズ: マイグレーション1本相当
- 依存: PST-023

## 目的

門田と直接つながる人物の外部プロジェクトを、scopeを壊さずに入力・展開できる拡張基盤にする。

## 実装範囲

- adminで`project.scope = external`のprojectとmembershipを編集できる契約。
- rawDataに依存せず、人手入力した外部project情報をexportする経路。
- 初期描画はmonden graphだけにし、personクリックで直接のexternal project（depth 1）を表示、
  external projectクリックでそのmembership（depth 2）を表示する。ここでの遅延はDOM展開であり、
  閲覧時にAPIへ問い合わせない。
- 外部projectをmuted grayで表示し、既存門田名義クエリは`scope = 'monden'`で絞る。
- 探索対象を「直接在籍重複またはevent共起した人物の主要バンド」に限定する運用表示。
- external projectを公開する前にslugレビューを通し、採用根拠をmembershipのnoteまたは運用記録に
  残す。

## テスト方針

- scopeの値、既定値、不正値をDB・admin APIの契約テストで確認する。
- external projectの作成・編集・export・表示をfixtureの一連の振る舞いで検証する。
- depth 1、クリック展開、同じprojectの重複表示防止をブラウザテストする。
- monden/external混在時の既存一覧・集計が変わらないことを回帰テストする。

## 受け入れ条件

- external projectとmembershipを既存のproject/membership構造で登録できる。
- 初期グラフに外部projectを無制限に表示せず、人物クリックで段階的に展開する。
- 外部projectがmuted grayで区別され、人物・projectの詳細リンクは通常のslug規約に従う。
- `/projects`や既存の門田関連集計がexternal行を誤って含めない。
- scope爆発を防ぐ入力ガイドラインがadminまたは運用文書に表示される。

## 対象外

外部バンド全体の網羅的リサーチ、外部project向けの新しいDBテーブル、depth 3以上の自動探索。
