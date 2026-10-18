###### 2026-10-18 Cloudflare移設Issue作成

- 現状確認：サイトは GitHub Pages（`fukurose-jun02/youtube_kodomotoodekake` の `main` 直下、legacy方式）で稼働中。URLは HTTP 200 で応答。ただし Pages の最新ビルド（2026-10-15）は `errored`（原因は未調査）
- ユーザーが Cloudflare アカウントを持っているため、移設を依頼された
- Issue [#11](https://github.com/fukurose-jun02/youtube_kodomotoodekake/issues/11) を作成（移設方式の選択肢 A: Cloudflare Pages / B: Workers静的アセット / C: 直接アップロード、チェックリスト、リスク）
- 移設方式は未決定。実作業はまだ着手していない

###### 次回
- 移設方式を決める（暫定推奨は A）

###### 追記：移設方式をBに確定
- ユーザーから「今後チャット等の機能を足す予定でAで良いか迷う」と相談。公式ドキュメントを確認し、Durable Objects・Cronが Pages では制限されることから B（Workers静的アセット配信）を再推奨
- ユーザー回答：独自ドメインは使わない／チャットは近いうちに実装予定 → **Bで確定**
- Issue #11 の本文を B 前提に書き換え（独自ドメイン関連の項目を削除、`wrangler.jsonc`・Workers Builds・配信対象の絞り込みを追加）
- 判断データログ（judgments.jsonl）に追記

###### 次回
- 移設の実作業（`wrangler.jsonc` 作成・Cloudflare側のプロジェクト作成と GitHub 連携）
- チャット機能のIssue起票

###### 追記：移設用の設定ファイルを作成しPR化（PR #12）
- ブランチ `feature/cloudflare-workers` で `wrangler.jsonc`（Worker名 `kodomo-odekake`）、`.assetsignore`、`.gitignore`（`.wrangler/`）を追加し、[PR #12](https://github.com/fukurose-jun02/youtube_kodomotoodekake/pull/12) を作成（未マージ）
- 調査結果：配信に必要なのは `index.html`・`tweaks-panel.jsx`・`uploads/` のみ。動画データは `sync-videos.js` が `index.html` に埋め込むため、`data/videos.json` はブラウザから読まれない
- `.assetsignore` は許可リスト方式（`.env` などの公開事故を防ぐため）。ローカルの `wrangler dev` で、`.env`・`scripts/`・`data/`・`logs/`・`.git/` が404、サイト本体・画像（166枚、読み込み失敗なし）は表示できることを確認
- ローカルの作業ツリーに、移設と無関係な `uploads/` の整理途中の変更（リネーム・`重複/`）が未コミットで残っている。今回は触っていない

###### 次回
- PR #12 のマージ後、Cloudflare ダッシュボードで GitHub 連携（デプロイコマンド `npx wrangler deploy`）→ 公開URLでの表示確認 → Issue #11 のチェックリスト更新

###### 追記：Cloudflareで公開、表示確認まで完了
- PR #12 をマージし、Cloudflare ダッシュボードで GitHub 連携（Worker名 `kodomo-odekake`、ビルドコマンドなし、デプロイコマンド `npx wrangler deploy`、Access保護はオフ）→ ビルド成功（Build #8f027461、アップロード30件）
- 公開URL：https://kodomo-odekake.fukuchan-app.workers.dev
- 確認結果：`index.html` はGitHub Pages・リポジトリのものとバイト単位で同一。`.env`・`scripts/`・`data/`・`logs/`・`.git/` などは404。動画の埋め込み再生はユーザーが手元で確認済み（私のブラウザ画面は `*.workers.dev` へのアクセス許可が反映されず、画面での確認は未実施）
- Issue #11 のチェックリストを更新し、進捗コメントを追加

###### 残り・次回
- 旧URL（github.io）の扱いを決める（そのまま残す／Pagesを無効化する／新URLへの案内）
- URLを載せている箇所の更新（YouTube概要欄・SNSなど外部の告知）
- 動画データ更新の流れ（`sync-videos.js` → commit → 自動デプロイ）が動くことを確認
- GitHub Pages の無効化（新URLでの運用確認後）
- チャット機能のIssue起票

###### 追記：GitHub Pages を無効化
- ユーザーの判断で旧URLを即時無効化。`gh api -X DELETE repos/fukurose-jun02/youtube_kodomotoodekake/pages` を実行（ユーザーの許可後）
- 確認：旧URL（github.io）は404、新URL（workers.dev）は200。Pages API も404（無効化済み）。再度有効化すれば元に戻せる
- 判断：旧URLの扱いは「すぐ無効化」を選択（案：しばらく残す／すぐ無効化）。外部告知のURL差し替えより先に無効化したため、旧URLを載せた場所はリンク切れになる

###### 残り・次回
- URLを載せている箇所（YouTube概要欄・SNSなど）を新URLに差し替える
- 動画データ更新の流れ（`sync-videos.js` → commit → 自動デプロイ）が動くことを確認（次回の動画更新時）
- チャット機能のIssue起票

###### 追記：チャット機能のIssue起票
- [Issue #13](https://github.com/fukurose-jun02/youtube_kodomotoodekake/issues/13)「サイトにチャット機能を追加する」を作成
- 内容：要件が未確定のため、「要決定」を先頭に置いた。チャットの単位（A: サイト全体で1部屋 ★暫定／B: 動画ごと／C: リアルタイムでない掲示板）、利用者とログイン、履歴の扱い。設計上の論点として、安全面（投稿内容の管理・個人情報・荒らし対策。子どもの利用の可能性が大きな分岐）、料金（無料枠は未確認）、構成変更などを記載
- 実装には着手していない。次は「要決定」を決め、開発文書（`docs/` の3文書）を作る

###### 追記：チャット機能は後日に延期
- チャット機能（Issue #13）は「また今度」とのことで、未着手のまま保留。再開時は Issue の「要決定」3点（チャットの単位・利用者とログイン・履歴の扱い）から始める

###### 本日の最終状態（2026-10-18）
- 公開先：Cloudflare Workers（https://kodomo-odekake.fukuchan-app.workers.dev）。`main` への push で自動デプロイされる設定
- GitHub Pages：無効化済み（旧URLは404）
- Issue #11：チェックリスト7項目のうち5項目が完了。未完了は「URLを載せている箇所の更新（YouTube概要欄・SNSなど）」「動画データ更新の流れ（`sync-videos.js` → commit → 自動デプロイ）の確認」の2つ
- Issue #13（チャット）：起票のみ、保留
- 実施した変更：PR #12（`wrangler.jsonc`・`.assetsignore`・`.gitignore`）をマージ済み。ローカルに移設と無関係な `uploads/` の整理途中の変更（リネーム・`重複/`）が未コミットで残っている（今回は触っていない）
