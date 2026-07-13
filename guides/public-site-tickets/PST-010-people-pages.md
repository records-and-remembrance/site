# PST-010 人物一覧・詳細

- フェーズ: P2
- 対応箇所: 設計書 §3.2、§4.4
- 想定サイズ: マイグレーション1本相当
- 依存: PST-008

## 目的

人物をプロジェクト横断の線として提示し、在籍・クレジット・共演から回遊できるようにする。

## 実装範囲

- `/people` の人物一覧と基本メタデータ。
- `/people/:slug` のdescription、membershipタイムライン、役割サマリ。
- `activeFrom/To`がNULLの場合のmembership・contribution由来期間。
- composition_credit、contributionの対象別一覧、0件タブの非表示。
- 期間重複・event共起による共演者一覧と隣接リンク。

## テスト方針

- active期間導出の最小日・最大日を先にfixtureテストする。
- 役割カテゴリ、作曲／作詞順、release・event・recordingの空タブを検証する。
- support在籍と通常在籍を区別して表示することをテストする。
- 伊藤大地相当の複数プロジェクトfixtureと、関連0件の人物fixtureを静的buildする。

## 受け入れ条件

- `/people` から確定slugの人物詳細へ遷移できる。
- membership期間がプロジェクトごとに重なって見え、プロジェクト・作品・ライブ・楽曲へ遷移できる。
- personの活動期間がNULLでも、関連データから導出した期間を表示できる。
- recording対象のcontributionが0件でも空タブを表示しない。
- 共演者の根拠がmembership期間重複またはevent共起のどちらかで説明可能である。

## 対象外

外部プロジェクトの新規データ入力、networkのノード配置、記事mentionのリンク。
