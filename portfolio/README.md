# ゆーすけのホームページ制作 — 自分のサービスサイト

Cloudflare Workers で公開するサイトです。相談フォームの内容は、Cloudflare の Email Routing でメールに届きます。

- `public/index.html` `public/style.css` … ページ本体
- `public/assets/` … 背景動画（`hero.webm` `hero.mp4` `poster.jpg`）と作品の画像
- `src/worker.js` … 相談フォーム（`/api/contact`）を受け取り、メールで知らせる。相手のアドレスが返信先になるので、届いたメールにそのまま返信できる

## 公開のしかた

1. Cloudflare →「Workers & Pages」→「作成」→「リポジトリをインポート」で `first-netlify-project` を選ぶ
2. **ルートディレクトリ**を `portfolio` にしてデプロイ
3. `https://yusuke-web.<アカウント名>.workers.dev` で見られます

## 相談フォームのメールを受け取る設定

設定するまでは、フォームを送ると「準備中です」と表示されます。

1. 屋号のドメインを取り、Cloudflare で管理する
2. そのドメインで「Email Routing」を有効にし、受け取るアドレス（Gmail など）を登録して「確認済み」にする
3. `wrangler.jsonc` の `send_email` と `vars` のコメントを外し、アドレスを書きかえる
   - `destination_address` / `MAIL_TO`：受け取るアドレス
   - `MAIL_FROM`：送信元。Email Routing を設定したドメインのアドレス（例：`form@あなたのドメイン`）

## 公開前に書きかえるところ

- 屋号・ロゴ（いまは仮に「ゆーすけ WEB」）
- 料金（いまは案の金額）
- 実績「電気のひらた。」の掲載：平田さまに掲載の許可をもらう（画像は `assets/work-hirata.jpg` と `assets/insta-*.jpg`）
- 「デモサイトを見る」のリンク先（水道屋さんのページを公開したURL）
