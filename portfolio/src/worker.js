// ゆーすけのホームページ制作 — Cloudflare Worker
// 静的ファイルは public/ から配信され、ここには /api/contact へのフォーム送信だけが届く。
// 通知メールは Cloudflare Email Routing の send_email バインディング（SEND_EMAIL）で送る。
import { EmailMessage } from "cloudflare:email";

const FIELDS = {
  name: "お名前",
  shop: "お店・会社の名前",
  email: "メールアドレス",
  kind: "ご相談の内容",
  message: "くわしい内容",
};
const MAX_LEN = { name: 100, shop: 100, email: 200, kind: 50, message: 3000 };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

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
      return errorPage(400, "送信内容を読み取れませんでした。");
    }

    // ボット対策：人間には見えない欄に入力があれば、成功したふりをして捨てる
    if (form.get("bot-field")) {
      return Response.redirect(new URL("/thanks", url), 303);
    }

    const data = {};
    for (const key of Object.keys(FIELDS)) {
      // 改行はメールのヘッダーに入らないよう、本文以外では取りのぞく
      let v = String(form.get(key) ?? "").trim().slice(0, MAX_LEN[key]);
      if (key !== "message") v = v.replace(/[\r\n]+/g, " ");
      data[key] = v;
    }
    if (!data.name || !data.email) {
      return errorPage(400, "お名前とメールアドレスを入力してください。");
    }
    if (!EMAIL_RE.test(data.email)) {
      return errorPage(400, "メールアドレスの形が正しくないようです。もう一度ご確認ください。");
    }

    if (!env.SEND_EMAIL || !env.MAIL_FROM || !env.MAIL_TO) {
      console.error("contact: メール送信の設定（SEND_EMAIL / MAIL_FROM / MAIL_TO）がありません", data);
      return errorPage(503, "ただいまフォームを準備中です。");
    }

    try {
      const raw = buildMail(env.MAIL_FROM, env.MAIL_TO, data, request);
      await env.SEND_EMAIL.send(new EmailMessage(env.MAIL_FROM, env.MAIL_TO, raw));
    } catch (err) {
      console.error("contact: メール送信に失敗", err, data);
      return errorPage(500, "送信に失敗しました。");
    }

    return Response.redirect(new URL("/thanks", url), 303);
  },
};

function buildMail(from, to, data, request) {
  const lines = Object.entries(FIELDS).map(([key, label]) => `■ ${label}\n${data[key] || "（未入力）"}\n`);
  lines.push(`受信日時：${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);
  lines.push(`送信元IP：${request.headers.get("CF-Connecting-IP") ?? "不明"}`);
  const body = `ホームページの相談フォームから連絡がありました。\nこのメールにそのまま返信すると、相手に届きます。\n\n${lines.join("\n")}\n`;

  const who = data.shop ? `${data.shop} ${data.name}` : data.name;
  const subject = `【ご相談】${who} 様（${data.kind || "内容未選択"}）`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${data.email}`,
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

function errorPage(status, reason) {
  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>送信できませんでした | ゆーすけのホームページ制作</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="/style.css"></head>
<body><main class="section" style="min-height:100vh;display:grid;place-items:center;text-align:center">
<div class="wrap"><p class="eyebrow" style="justify-content:center">SORRY</p>
<h1 class="title">送信できませんでした</h1>
<p style="color:var(--ink-soft);margin:-24px 0 32px">${escapeHtml(reason)}<br>お手数ですが、少し時間をおいてもう一度お試しください。</p>
<a href="/#contact" class="btn btn--ink">フォームにもどる</a></div></main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
