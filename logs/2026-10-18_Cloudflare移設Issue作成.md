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
