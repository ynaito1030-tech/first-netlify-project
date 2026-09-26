// まちのすいどうさん — Cloudflare Worker
// 静的ファイルは public/ から配信され、ここには /api/contact へのフォーム送信だけが届く。
// 通知メールは Cloudflare Email Routing の send_email バインディング（SEND_EMAIL）で送る。
import { EmailMessage } from "cloudflare:email";

const FIELDS = {
  name: "お名前",
  tel: "電話番号",
  address: "ご住所",
  place: "こまっている場所",
  message: "くわしい症状",
};
const MAX_LEN = { name: 100, tel: 30, address: 200, place: 50, message: 3000 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/contact") {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return errorPage(env, request, 400, "送信内容を読み取れませんでした。");
    }

    // ボット対策：人間には見えない欄に入力があれば、成功したふりをして捨てる
    if (form.get("bot-field")) {
      return Response.redirect(new URL("/thanks", url), 303);
    }

    const data = {};
    for (const key of Object.keys(FIELDS)) {
      data[key] = String(form.get(key) ?? "").trim().slice(0, MAX_LEN[key]);
    }
    if (!data.name || !data.tel) {
      return errorPage(env, request, 400, "お名前と電話番号を入力してください。");
    }

    if (!env.SEND_EMAIL || !env.MAIL_FROM || !env.MAIL_TO) {
      console.error("contact: メール送信の設定（SEND_EMAIL / MAIL_FROM / MAIL_TO）がありません", data);
      return errorPage(env, request, 503, "ただいまフォームを準備中です。");
    }

    try {
      const raw = buildMail(env.MAIL_FROM, env.MAIL_TO, data, request);
      await env.SEND_EMAIL.send(new EmailMessage(env.MAIL_FROM, env.MAIL_TO, raw));
    } catch (err) {
      console.error("contact: メール送信に失敗", err, data);
      return errorPage(env, request, 500, "送信に失敗しました。");
    }

    return Response.redirect(new URL("/thanks", url), 303);
  },
};

function buildMail(from, to, data, request) {
  const lines = Object.entries(FIELDS).map(([key, label]) => `■ ${label}\n${data[key] || "（未入力）"}\n`);
  lines.push(`受信日時：${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);
  lines.push(`送信元IP：${request.headers.get("CF-Connecting-IP") ?? "不明"}`);
  const body = `ホームページからお問い合わせがありました。\n\n${lines.join("\n")}\n`;

  const subject = `【お問い合わせ】${data.name} 様（${data.place || "場所未選択"}）`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split("@")[1]}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(body).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
}

function encodeHeader(text) {
  return `=?UTF-8?B?${base64(text)}?=`;
}

function base64(text) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function errorPage(env, request, status, reason) {
  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>送信できませんでした | まちのすいどうさん</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="/style.css"></head>
<body><main class="section section--sky" style="min-height:100vh;display:grid;place-items:center">
<div class="container container--narrow" style="text-align:center">
<h1 class="title"><small>ごめんなさい</small>送信できませんでした</h1>
<p class="lead lead--center">${escapeHtml(reason)}<br>お手数ですが、お電話でご連絡ください。</p>
<p style="margin:28px 0"><a href="tel:0120000000" class="btn btn--tel btn--big">☎ 0120-000-000<small>通話無料・24時間うけつけ</small></a></p>
<p><a href="/#contact" style="color:var(--blue);font-weight:800">← フォームにもどる</a></p>
</div></main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
