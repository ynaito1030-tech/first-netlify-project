# ゆーすけのホームページ制作 — 自分のサービスサイト

Cloudflare Workers で公開する静的サイトです。

- `public/index.html` `public/style.css` … ページ本体
- `public/assets/` … 背景動画（`hero.webm` `hero.mp4` `poster.jpg`）と作品の画像

## 公開のしかた

1. Cloudflare →「Workers & Pages」→「作成」→「リポジトリをインポート」で `first-netlify-project` を選ぶ
2. **ルートディレクトリ**を `portfolio` にしてデプロイ
3. `https://yusuke-web.<アカウント名>.workers.dev` で見られます

## 公開前に書きかえるところ

- 屋号・ロゴ（いまは仮に「ゆーすけ WEB」）
- 料金（いまは案の金額）
- 「デモサイトを見る」のリンク先（水道屋さんのページを公開したURL）
- 「リベシティでDMする」のリンク先（リベシティのプロフィールURL）
