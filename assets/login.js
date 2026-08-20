/* ============================================================
   採点ナビ — ログイン画面
   入力チェックと認証 API への送信を担当する。
   ============================================================ */

(function () {
  'use strict';

  /* ------------------------------------------------------------
     認証 API の接続先。
     この静的サイト自体は認証を持たないので、既定では空にしてある。
     バックエンドを用意したら、そのパス（例 '/api/login'）を入れる。
     期待する仕様:
       POST  Content-Type: application/json
       body  { "email": "...", "password": "..." }
       200   ログイン成功（セッションは Set-Cookie で発行する）
       401   メールアドレスまたはパスワードが違う
     ------------------------------------------------------------ */
  var AUTH_ENDPOINT = '';

  /* ログイン後の既定の遷移先 */
  var DEFAULT_REDIRECT = '/';

  /* メールアドレスを覚えておく保存先（パスワードは保存しない） */
  var EMAIL_KEY = 'saiten-navi.login.email.v1';

  var form, emailEl, passwordEl, rememberEl, submitBtn, toggleBtn, statusEl;
  var sending = false;

  /* ---------- 表示ヘルパー ---------- */

  function showStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = 'auth__status' + (kind === 'error' ? ' auth__status--error' : '');
    statusEl.hidden = false;
  }

  function clearStatus() {
    statusEl.textContent = '';
    statusEl.hidden = true;
  }

  function showFieldError(input, message) {
    var box = document.getElementById(input.id + 'Error');
    box.textContent = message;
    box.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(input) {
    var box = document.getElementById(input.id + 'Error');
    box.textContent = '';
    box.hidden = true;
    input.removeAttribute('aria-invalid');
  }

  /* ---------- 入力チェック ---------- */

  /* 「@ の前後に文字があり、空白を含まない」程度の緩いチェック。
     厳密な判定はサーバー側に任せる。 */
  function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validate() {
    var ok = true;
    var email = emailEl.value.trim();

    if (!email) {
      showFieldError(emailEl, 'メールアドレスを入力してください。');
      ok = false;
    } else if (!looksLikeEmail(email)) {
      showFieldError(emailEl, 'メールアドレスの形式が正しくありません。');
      ok = false;
    } else {
      clearFieldError(emailEl);
    }

    if (!passwordEl.value) {
      showFieldError(passwordEl, 'パスワードを入力してください。');
      ok = false;
    } else {
      clearFieldError(passwordEl);
    }

    if (!ok) {
      (emailEl.getAttribute('aria-invalid') ? emailEl : passwordEl).focus();
    }
    return ok;
  }

  /* ---------- 遷移先 ---------- */

  /* ?redirect= は同一サイト内のパスだけ許可する。
     '//example.com' のような別サイトへの誘導は捨てる。 */
  function safeRedirect() {
    var match = /[?&]redirect=([^&]*)/.exec(window.location.search);
    if (!match) return DEFAULT_REDIRECT;

    var target;
    try {
      target = decodeURIComponent(match[1]);
    } catch (e) {
      return DEFAULT_REDIRECT;
    }

    if (target.charAt(0) !== '/' || target.charAt(1) === '/' || target.charAt(1) === '\\') {
      return DEFAULT_REDIRECT;
    }
    return target;
  }

  /* ---------- 送信 ---------- */

  function setSending(state) {
    sending = state;
    submitBtn.disabled = state;
    submitBtn.textContent = state ? 'ログイン中…' : 'ログイン';
  }

  function rememberEmail(email) {
    try {
      if (rememberEl.checked) {
        window.localStorage.setItem(EMAIL_KEY, email);
      } else {
        window.localStorage.removeItem(EMAIL_KEY);
      }
    } catch (e) {
      /* プライベートモードなどで保存できなくてもログインは続行する */
    }
  }

  function restoreEmail() {
    var saved = null;
    try {
      saved = window.localStorage.getItem(EMAIL_KEY);
    } catch (e) {
      saved = null;
    }
    if (saved) {
      emailEl.value = saved;
      rememberEl.checked = true;
      passwordEl.focus();
    }
  }

  function submit(event) {
    event.preventDefault();
    if (sending) return;

    clearStatus();
    if (!validate()) return;

    var email = emailEl.value.trim();
    rememberEmail(email);

    if (!AUTH_ENDPOINT) {
      showStatus(
        '認証サーバーが接続されていません。assets/login.js の AUTH_ENDPOINT に認証 API のパスを設定してください。'
      );
      return;
    }

    setSending(true);

    window.fetch(AUTH_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: passwordEl.value })
    }).then(function (response) {
      if (response.ok) {
        window.location.assign(safeRedirect());
        return;
      }
      setSending(false);
      passwordEl.value = '';
      if (response.status === 401 || response.status === 400) {
        showStatus('メールアドレスまたはパスワードが違います。', 'error');
      } else if (response.status === 429) {
        showStatus('試行回数が多すぎます。しばらく時間をおいてからお試しください。', 'error');
      } else {
        showStatus('ログインできませんでした。時間をおいて、もう一度お試しください。', 'error');
      }
      passwordEl.focus();
    }).catch(function () {
      setSending(false);
      showStatus('通信に失敗しました。ネットワークの状態を確認してください。', 'error');
    });
  }

  /* ---------- 起動 ---------- */

  function init() {
    form       = document.getElementById('loginForm');
    emailEl    = document.getElementById('email');
    passwordEl = document.getElementById('password');
    rememberEl = document.getElementById('remember');
    submitBtn  = document.getElementById('submitBtn');
    toggleBtn  = document.getElementById('togglePassword');
    statusEl   = document.getElementById('status');

    restoreEmail();

    form.addEventListener('submit', submit);

    [emailEl, passwordEl].forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid')) clearFieldError(input);
      });
    });

    toggleBtn.addEventListener('click', function () {
      var shown = passwordEl.type === 'text';
      passwordEl.type = shown ? 'password' : 'text';
      toggleBtn.textContent = shown ? '表示' : '隠す';
      toggleBtn.setAttribute('aria-pressed', shown ? 'false' : 'true');
      passwordEl.focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
