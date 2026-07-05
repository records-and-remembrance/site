# Project Instructions

## Shell Commands

- Use `docker compose exec -T postgres psql -U monden -d monden` for PostgreSQL
  access.
- The project-local Codex rule is defined in `.codex/rules/default.rules`.

## Project Guides

Refer to these files when the task touches project structure, data modeling, or
seed generation:

- `guides/project-overview-for-agents.md`
- `guides/data-structure.md`

## Developer Notes

- t-wadaの提唱するTDDの考え方に従い、まずテストコードを書き、次に実装コードを書き、最後にリファクタリングする
- テストは振る舞いと契約を対象とする。ディレクトリ配置やファイル移動そのものを固定するテストは書かない
- `tsc`、lint、formatterで機械的に検出できる型エラー、import解決、静的規約、フォーマットを重複してテストしない
- 1つの依頼が終わるごとに、1つのコミットを作る。または、目安として1000行以上の変更を加えたら1つのコミットにまとめる。テストと実装コードで1つのコミットにまとめるという単位が望ましい
- コミットメッセージは日本語で記述する
- ローカルでのみ利用するアプリのため、後方互換性を考える必要はない。DBの内容が不整合を起こさないことだけ守って、他は破壊的に変更してよい。

## Server-side Design

- 状態を保持する必要がないサーバーサイド実装では class
  を使わず、関数とオブジェクトで構成する
- データベースなどの依存はモジュールのグローバル値として処理から直接参照せず、依存を先に受け取るカリー化関数で束縛する
- 処理の分岐を一つの大きな関数やクラスに集約せず、小さな関数の合成を優先する
- ディレクトリは親ドメイン単位で分割する。親ドメインは、メインテーブルとその配下の関連データを一つのまとまりとして判断する
