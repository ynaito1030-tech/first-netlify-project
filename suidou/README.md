# まちのすいどうさん — ホームページ

Cloudflare Workers で公開する水道工事店のホームページです。

- `public/` … ページ本体（HTML / CSS）。そのまま配信されます
- `public/assets/hero.webm` `hero.mp4` `poster.jpg` … 最初の画面の背景動画（いまは仮の動画）
- `src/worker.js` … お問い合わせフォーム（`/api/contact`）を受け取り、メールで知らせます
- `wrangler.jsonc` … Cloudflare の設定

## 公開のしかた（Cloudflare ダッシュボード）

1. Cloudflare にログイン →「Workers & Pages」→「作成」→「リポジトリをインポート」
2. GitHub の `first-netlify-project` を選ぶ
3. 設定
   - **ルートディレクトリ**：`suidou`
   - **デプロイコマンド**：`npx wrangler deploy`（最初から入っていればそのまま）
4. 「デプロイ」を押すと `https://machi-suidou.<アカウント名>.workers.dev` で見られます
5. 独自ドメインは、Worker の「設定」→「ドメインとルート」から追加します

## お問い合わせメールを受け取る設定

フォームの内容は Cloudflare の Email Routing でメール送信します。設定するまでは、
フォームを送ると「準備中です。お電話ください」と表示されます。

1. ドメインを Cloudflare で管理する
2. そのドメインで「Email Routing」を有効にし、受け取りたいメールアドレスを登録して「確認済み」にする
3. `wrangler.jsonc` の `send_email` と `vars` のコメントを外し、アドレスを書きかえる
   - `destination_address` / `MAIL_TO`：受け取るアドレス（確認済みのもの）
   - `MAIL_FROM`：送信元。Email Routing を設定したドメインのアドレス（例：`form@あなたのドメイン`）
4. GitHub にプッシュすると自動で反映されます

## 背景動画の差し替え

`public/assets/` の3つのファイルを同じ名前で置きかえます。

- `hero.mp4`（Safari 用）と `hero.webm`（Chrome・Firefox 用）：音なし、10〜20秒、横長。ファイルは数MBまでに
- `poster.jpg`：動画を読みこむまでに見せる画像（動画の最初のコマ）

## 手元での確認

```sh
cd suidou
npx wrangler dev
```

http://localhost:8787 で表示されます。
