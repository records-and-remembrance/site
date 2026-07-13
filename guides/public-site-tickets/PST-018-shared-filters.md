# PST-018 フィルタとURL状態復帰

- フェーズ: P2
- 対応箇所: 設計書 §4.2、§4.5、§4.7
- 想定サイズ: マイグレーション1本相当
- 依存: PST-011、PST-015

## 目的

フィルタを持つ画面で、操作状態をURLに反映し、URL直開きでも完全に復元する。

## 実装範囲

- query schemaを固定する。`/discography` は繰り返し可能な `project` / `format` /
  `decade` / `editionType`、`/lives` は `project` / `venue` / `year`、`/timeline` は
  `project` / `kind` を使う。entity値はslug、`kind` は `release` / `event` /
  `membership` / `project` のみを許可する。
- client island初期化時のURL読み取り、操作時のURL更新、戻る／進む対応。
- `/discography`、`/lives`への適用と、後続の`/timeline`に使える共通adapter。
- 未知・不正なqueryの無視と既定値への復帰。複数値は重複を除き辞書順で直列化し、
  query正規化時にも現在のhash fragmentを保持する。

## テスト方針

- queryのparse／serializeを先に純粋関数でテストし、順序・複数値・空値・hash保持を検証する。
- 直リンク、操作、ブラウザ戻る／進む、未知queryをブラウザテストする。
- 同じ条件で同じ一覧になることをfixtureで確認する。
- queryがない初期表示と、選択解除後のURLが契約どおりになることを検証する。

## 受け入れ条件

- `/discography?project=...&format=...` を直接開くと選択状態と一覧が一致する。
- `/lives?project=...&venue=...&year=...` を直接開くと同じ条件が復元される。
- 操作結果をリロードしても状態が失われない。
- 不正な値で画面が白紙にならず、該当条件を安全に無視する。
- 後続のtimelineが同じURL状態契約を利用できる。

## 対象外

検索語のPagefind管理、Digのランダム状態、networkの表示トグル。
