(function () {
  "use strict";
  var document = window.document;
  var root = document.querySelector('meta[name="bologna-ranking-api"]');
  var API_BASE = root ? root.content.trim().replace(/\/+$/, "") : "";
  var path = window.location.pathname;
  var isStagingPreview = path.indexOf("/preview/halloween-ranking-2026/") === 0;
  var isLegacyPreview = path.indexOf("/preview/halloween-2026/") === 0;
  var IDENTITY_KEY = isStagingPreview
    ? "bologna-students.halloween-ranking.identity.staging.2026.v1"
    : isLegacyPreview
      ? "bologna-students.halloween-ranking.identity.preview.v1"
      : "bologna-students.halloween-ranking.identity.production.v1";
  var MIGRATION_KEYS = !isStagingPreview && !isLegacyPreview
    ? ["bologna-students.halloween-ranking.identity.staging.2026.v1", "bologna-students.halloween-ranking.identity.preview.v1"]
    : [];
  var state = {
    configured: false,
    config: null,
    identity: null,
    board: "overall",
    currentProfile: null,
    captchaTokens: {},
    captchaWidgets: {},
    turnstileLoading: null,
    challenges: {},
    memoryIdentity: null,
    ready: null
  };

  var byId = function (id) { return document.getElementById(id); };
  var connection = byId("ranking-connection");
  var list = byId("leaderboard-list");
  var empty = byId("leaderboard-empty");
  var personalRank = byId("personal-rank");
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-board]"));

  function isValidIdentity(value) {
    return !!value && typeof value === "object" && typeof value.token === "string" && /^[A-Za-z0-9_-]{32,100}$/.test(value.token) &&
      typeof value.publicCode === "string" && /^BS-[0-9A-HJKMNP-TV-Z]{8}$/.test(value.publicCode) && typeof value.nickname === "string";
  }

  function readIdentity() {
    try {
      var value = window.localStorage.getItem(IDENTITY_KEY);
      value = value ? JSON.parse(value) : null;
      if (!isValidIdentity(value)) {
        value = null;
        for (var i = 0; i < MIGRATION_KEYS.length; i += 1) {
          var legacy = window.localStorage.getItem(MIGRATION_KEYS[i]);
          if (!legacy) continue;
          try { legacy = JSON.parse(legacy); } catch (_) { legacy = null; }
          if (!isValidIdentity(legacy)) continue;
          value = legacy;
          window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(value));
          break;
        }
      }
    } catch (_) { return state.memoryIdentity; }
    if (!isValidIdentity(value)) return null;
    return value;
  }

  function writeIdentity(value) {
    state.memoryIdentity = value;
    state.identity = value;
    try {
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(value));
      return true;
    } catch (_) { return false; }
  }

  function clearIdentity() {
    state.identity = null;
    state.memoryIdentity = null;
    try {
      window.localStorage.removeItem(IDENTITY_KEY);
      MIGRATION_KEYS.forEach(function (key) { window.localStorage.removeItem(key); });
    } catch (_) { /* This browser can continue in-memory. */ }
  }

  function apiUrl(route) { return API_BASE + route; }

  async function api(route, options) {
    options = options || {};
    var headers = new Headers(options.headers || {});
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (state.identity && state.identity.token && options.auth !== false) headers.set("Authorization", "Bearer " + state.identity.token);
    var response = await window.fetch(apiUrl(route), {
      method: options.method || "GET",
      headers: headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "omit",
      cache: "no-store",
      mode: "cors"
    });
    var data = {};
    try { data = await response.json(); } catch (_) { /* A non-JSON error is shown generically below. */ }
    if (!response.ok) {
      var error = new Error(data.message || "排行榜服务暂时不可用。");
      error.code = data.error || "request_failed";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setConnection(message, stateName) {
    if (!connection) return;
    connection.textContent = message;
    connection.dataset.state = stateName || "neutral";
  }

  function setFormMessage(form, message) {
    var old = form.querySelector("[data-form-message]");
    if (!old) {
      old = document.createElement("p");
      old.className = "form-help form-message";
      old.dataset.formMessage = "true";
      old.setAttribute("role", "status");
      old.setAttribute("aria-live", "polite");
      form.appendChild(old);
    }
    old.textContent = message;
  }

  function setRankStatus(message) {
    if (personalRank) {
      personalRank.textContent = message;
      personalRank.hidden = false;
    }
  }

  function openDialog(id) {
    var dialog = byId(id);
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(id) {
    var dialog = byId(id);
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
    button.addEventListener("click", function () { closeDialog(button.dataset.closeDialog); });
  });

  function localTurnstile() {
    return !!(state.config && state.config.turnstile && state.config.turnstile.mode === "local-test");
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    if (state.turnstileLoading) return state.turnstileLoading;
    state.turnstileLoading = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("验证组件暂时加载失败，请稍后重试。")); };
      document.head.appendChild(script);
    });
    return state.turnstileLoading;
  }

  async function captchaToken(slot) {
    if (localTurnstile()) return "local-test-pass";
    var token = state.captchaTokens[slot];
    if (!token) throw new Error("请先完成页面上的人机验证。 ");
    state.captchaTokens[slot] = "";
    if (state.captchaWidgets[slot] !== undefined && window.turnstile) window.turnstile.reset(state.captchaWidgets[slot]);
    return token;
  }

  function renderIdentity() {
    var joined = !!(state.identity && state.identity.token && state.identity.publicCode);
    tabs.forEach(function (tab) { tab.disabled = !state.configured; });
    var registerButton = byId("ranking-show-register");
    var restoreButton = byId("ranking-show-restore");
    var manageButton = byId("ranking-show-manage");
    if (registerButton) { registerButton.disabled = !state.config || !state.config.signupEnabled || joined; registerButton.hidden = joined; }
    if (restoreButton) { restoreButton.disabled = !state.config || !state.config.recoveryEnabled || joined; restoreButton.hidden = joined; }
    if (manageButton) manageButton.hidden = !joined;
    byId("ranking-register-form").hidden = true;
    byId("ranking-restore-form").hidden = true;
    byId("ranking-manage-form").hidden = true;
    if (joined) {
      byId("ranking-linked-player").textContent = "「" + state.identity.nickname + "」 · " + state.identity.publicCode;
      byId("ranking-change-name").value = state.identity.nickname;
    }
  }

  function stat(label, value) {
    var wrapper = document.createElement("div");
    var term = document.createElement("dt");
    var description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    wrapper.appendChild(term);
    wrapper.appendChild(description);
    return wrapper;
  }

  function formatTime(profile) {
    if (!profile) return "未上榜";
    return "第 " + profile.rank + " 名 · " + (profile.elapsedMs / 1000).toFixed(2) + " 秒（误差 " + (profile.errorMs / 1000).toFixed(2) + " 秒）";
  }

  function shareParts(profile) {
    var overall = profile.overall ? "第 " + profile.overall.rank + " 名 · " + profile.overall.points.toFixed(2) + " 分" : "尚无综合名次";
    var time = formatTime(profile.time);
    var candy = profile.candy ? "第 " + profile.candy.rank + " 名 · " + profile.candy.score + " / 20 分" : "未上榜";
    var puzzle = profile.puzzle.completed ? "已通关" + (profile.puzzle.rank ? " · 第 " + profile.puzzle.rank + " 名" : "") : "尚未通关";
    var url = new URL("arcade.html?profile=" + encodeURIComponent(profile.publicCode), window.location.href).href;
    return {
      title: "Bologna Halloween · " + profile.nickname,
      text: "🎃 Bologna Halloween Arcade\n我是「" + profile.nickname + "」· " + profile.publicCode + "\n十秒挑战：" + time + "\n南瓜投篮：" + candy + "\n谜团：" + puzzle + "\n综合排名：" + overall + "\n你排第几？来挑战 👇\n" + url,
      url: url
    };
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    var area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var copied = document.execCommand && document.execCommand("copy");
    area.remove();
    if (!copied) throw new Error("浏览器未允许复制；请长按选择战绩文本。 ");
  }

  async function shareProfile(profile) {
    var parts = shareParts(profile);
    if (navigator.share) {
      try { await navigator.share({ title: parts.title, text: parts.text, url: parts.url }); return; }
      catch (error) { if (error && error.name === "AbortError") return; }
    }
    try {
      await copyText(parts.text);
      setRankStatus("战绩文字和真实公开链接已复制，可以粘贴到微信群。 ");
    } catch (error) { setRankStatus(error.message || "复制失败，请手动截图分享。 "); }
  }

  function renderBoardEntry(entry, board) {
    var item = document.createElement("li");
    item.className = "leaderboard-row";
    if (state.identity && entry.publicCode === state.identity.publicCode) item.classList.add("is-self");
    item.dataset.publicCode = entry.publicCode;
    var rank = document.createElement("span");
    rank.className = "rank-medal";
    rank.setAttribute("aria-label", "第 " + entry.rank + " 名");
    rank.textContent = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : String(entry.rank);
    var player = document.createElement("span");
    player.className = "board-player";
    var name = document.createElement("button");
    name.type = "button";
    name.className = "board-name";
    name.textContent = entry.nickname;
    name.addEventListener("click", function () { openPlayer(entry.publicCode); });
    var code = document.createElement("span");
    code.className = "board-code";
    code.textContent = entry.publicCode;
    player.appendChild(name);
    player.appendChild(code);
    var score = document.createElement("span");
    score.className = "board-score";
    if (board === "time") score.textContent = (entry.elapsedMs / 1000).toFixed(2) + " 秒 · ±" + (entry.errorMs / 1000).toFixed(2);
    else if (board === "candy") score.textContent = entry.score + " / 20 分";
    else if (board === "puzzle") score.textContent = "谜团已解";
    else score.textContent = entry.points.toFixed(2) + " 分";
    item.appendChild(rank);
    item.appendChild(player);
    item.appendChild(score);
    return item;
  }

  async function loadBoard(board) {
    if (!state.configured || !list) return;
    state.board = board;
    tabs.forEach(function (tab) { tab.setAttribute("aria-pressed", String(tab.dataset.board === board)); });
    try {
      var result = await api("/v1/leaderboards?board=" + encodeURIComponent(board));
      list.replaceChildren();
      (result.entries || []).forEach(function (entry) { list.appendChild(renderBoardEntry(entry, board)); });
      empty.hidden = result.entries && result.entries.length > 0;
      if (empty) empty.textContent = result.entries && result.entries.length ? "" : "还没有公开成绩。欢迎第一个把南瓜玩明白的人。";
      if (result.self && personalRank) {
        personalRank.textContent = "你目前排第 " + result.self.rank + " 名" + (board === "overall" ? " · " + result.self.points.toFixed(2) + " 分" : "") + (result.self.rank > 10 ? "（前十名之外，继续挑战就能刷新最好成绩）" : " · 你在前十名里");
        personalRank.hidden = false;
      } else if (personalRank) personalRank.hidden = true;
    } catch (error) {
      if (list) list.replaceChildren();
      if (empty) { empty.hidden = false; empty.textContent = "公共榜单暂时无法载入；本机游戏和纪录不受影响。"; }
      if (error.status === 401) { clearIdentity(); renderIdentity(); }
    }
  }

  async function openPlayer(publicCode) {
    try {
      var profile = await api("/v1/players/" + encodeURIComponent(publicCode), { auth: false });
      state.currentProfile = profile;
      byId("public-profile-title").textContent = profile.nickname;
      byId("public-profile-code").textContent = profile.publicCode;
      var stats = byId("public-profile-stats");
      stats.replaceChildren(
        stat("综合排名 · 积分", profile.overall ? "第 " + profile.overall.rank + " 名 · " + profile.overall.points.toFixed(2) + " 分" : "尚无综合成绩"),
        stat("午夜十秒", formatTime(profile.time)),
        stat("南瓜投篮", profile.candy ? "第 " + profile.candy.rank + " 名 · " + profile.candy.score + " / 20 分" : "尚无上榜成绩"),
        stat("Bologna 谜团", profile.puzzle.completed ? "已通关" + (profile.puzzle.rank ? " · 第 " + profile.puzzle.rank + " 名" : "") : "尚未通关")
      );
      byId("public-profile-report-form").hidden = true;
      openDialog("public-profile-dialog");
    } catch (error) { setRankStatus(error.message || "无法载入这张战绩卡。 "); }
  }

  async function enroll(event) {
    event.preventDefault();
    var form = byId("ranking-register-form");
    var nickname = byId("ranking-register-name").value;
    if (!byId("ranking-consent").checked) return setFormMessage(form, "请先确认并同意数据说明。 ");
    var button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      var captcha = await captchaToken("register");
      var response = await api("/v1/players", { method: "POST", auth: false, body: { nickname: nickname, consent: true, turnstileToken: captcha } });
      var stored = writeIdentity({ token: response.token, publicCode: response.player.publicCode, nickname: response.player.nickname });
      state.configured = true;
      setConnection(stored ? "已连接 · 你的随机身份已保存在此浏览器" : "已连接 · 本机存储不可用，关闭页面后需要恢复码", stored ? "connected" : "warning");
      byId("ranking-register-name").value = "";
      byId("ranking-consent").checked = false;
      renderIdentity();
      byId("recovery-code-value").textContent = response.recoveryCode;
      byId("recovery-code-ack").checked = false;
      byId("recovery-code-done").disabled = true;
      openDialog("recovery-code-dialog");
      await reloadBoard();
    } catch (error) { setFormMessage(form, error.message || "创建失败，请稍后再试。 "); }
    finally { button.disabled = false; }
  }

  async function restore(event) {
    event.preventDefault();
    var form = byId("ranking-restore-form");
    var button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      var captcha = await captchaToken("restore");
      var response = await api("/v1/identity/restore", { method: "POST", auth: false, body: { recoveryCode: byId("ranking-recovery-input").value.trim(), turnstileToken: captcha } });
      var stored = writeIdentity({ token: response.token, publicCode: response.player.publicCode, nickname: response.player.nickname });
      byId("ranking-recovery-input").value = "";
      setConnection(stored ? "身份已恢复 · 此浏览器现已与原成绩关联" : "身份已恢复 · 本机存储不可用，请重新保存恢复码", stored ? "connected" : "warning");
      renderIdentity();
      await reloadBoard();
    } catch (error) { setFormMessage(form, error.message || "无法恢复身份，请检查恢复码。 "); }
    finally { button.disabled = false; }
  }

  async function changeNickname() {
    var form = byId("ranking-manage-form");
    var button = byId("ranking-change-submit");
    button.disabled = true;
    try {
      var captcha = await captchaToken("manage");
      var response = await api("/v1/identity/nickname", { method: "PATCH", body: { nickname: byId("ranking-change-name").value, turnstileToken: captcha } });
      if (response.changed) {
        state.identity.nickname = response.player.nickname;
        writeIdentity(state.identity);
        renderIdentity();
        await reloadBoard();
      }
      setFormMessage(form, response.changed ? "昵称已更新，参赛编号和历史最佳成绩保留。" : "这就是你当前使用的昵称。");
    } catch (error) { setFormMessage(form, error.message || "暂时无法修改昵称。 "); }
    finally { button.disabled = false; }
  }

  async function rotateRecovery() {
    var form = byId("ranking-manage-form");
    try {
      var captcha = await captchaToken("manage");
      var response = await api("/v1/identity/recovery-code", { method: "POST", body: { turnstileToken: captcha } });
      byId("recovery-dialog-title").textContent = "新的恢复码只显示这一次";
      byId("recovery-code-value").textContent = response.recoveryCode;
      byId("recovery-code-ack").checked = false;
      byId("recovery-code-done").disabled = true;
      openDialog("recovery-code-dialog");
    } catch (error) { setFormMessage(form, error.message || "无法更新恢复码。 "); }
  }

  async function deleteIdentity() {
    if (!window.confirm("删除后，公开昵称、成绩和身份凭证都会从本次排行榜中清除，不能撤销。继续吗？")) return;
    var form = byId("ranking-manage-form");
    try {
      var captcha = await captchaToken("manage");
      await api("/v1/identity", { method: "DELETE", body: { confirm: "DELETE_MY_PLAYER", turnstileToken: captcha } });
      clearIdentity();
      state.challenges = {};
      renderIdentity();
      setConnection("参赛身份及公开成绩已删除。", "neutral");
      await reloadBoard();
    } catch (error) { setFormMessage(form, error.message || "删除未完成；请重试。 "); }
  }

  async function logout() {
    try { await api("/v1/identity/session", { method: "DELETE" }); }
    catch (_) { /* Removing this browser's bearer token still makes it unusable here. */ }
    clearIdentity();
    state.challenges = {};
    renderIdentity();
    setConnection("已从此浏览器退出；公开记录仍保留。", "neutral");
    await reloadBoard();
  }

  async function submitReport(event) {
    event.preventDefault();
    var form = byId("public-profile-report-form");
    if (!state.identity) { setFormMessage(form, "提交举报需要一个随机参赛身份；不需要提供个人信息。 "); return; }
    if (!state.currentProfile) return;
    try {
      var captcha = await captchaToken("report");
      var response = await api("/v1/reports", { method: "POST", body: { publicCode: state.currentProfile.publicCode, reasonCode: byId("public-report-reason").value, turnstileToken: captcha } });
      setFormMessage(form, response.message || "举报已提交。 ");
    } catch (error) { setFormMessage(form, error.message || "举报未能提交。 "); }
  }

  function prepareChallenge(game) {
    var task = (async function () {
      if (state.ready) await state.ready;
      if (!state.configured || !state.identity) return null;
      try { return await api("/v1/challenges", { method: "POST", body: { game: game } }); }
      catch (_) { return null; }
    })();
    state.challenges[game] = task;
    return task;
  }

  async function submitGameScore(event) {
    var game = event.detail && event.detail.game;
    var body = event.detail && event.detail.result;
    if (!GAMES[game] || !state.identity || !state.configured) return;
    var challengeTask = state.challenges[game];
    delete state.challenges[game];
    var challenge = challengeTask ? await challengeTask : null;
    if (!challenge) {
      setRankStatus("本机纪录已保存；本局没有及时取得公共榜单凭证，因此未上传。下一局仍可再试。 ");
      return;
    }
    var idempotency = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : "submit-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    var payload = Object.assign({}, body, { game: game, sessionId: challenge.sessionId, challenge: challenge.challenge });
    try {
      var result = await api("/v1/scores", { method: "POST", body: payload, headers: { "Idempotency-Key": idempotency } });
      setRankStatus(result.message || "公共成绩已更新。 ");
      if (!result.pendingReview) await reloadBoard();
    } catch (error) {
      setRankStatus("本机纪录已保存；公共榜单提交失败：" + (error.message || "服务暂不可用。"));
    }
  }

  var GAMES = { time: true, candy: true, puzzle: true };

  function reloadBoard() { return loadBoard(state.board); }

  async function initialize() {
    if (!API_BASE) {
      setConnection("本机记录模式 · 公共榜单服务尚未连接", "neutral");
      if (empty) { empty.hidden = false; empty.textContent = "当前只保存本机纪录。公共排行榜需等待独立 Worker、D1 与验证服务获批配置；不影响游戏。"; }
      renderIdentity();
      return;
    }
    try {
      var parsed = new URL(API_BASE, window.location.href);
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsed.hostname))) throw new Error("榜单服务地址必须使用 HTTPS。 ");
      state.config = await api("/v1/config", { auth: false });
      state.configured = true;
      state.identity = readIdentity();
      var stored = state.identity;
      var persistent = false;
      try { persistent = !!window.localStorage.getItem(IDENTITY_KEY); } catch (_) { persistent = false; }
      setConnection(stored ? (persistent ? "已连接 · " + stored.nickname + " · " + stored.publicCode : "已连接 · 身份只暂存在本页") : "已连接 · 加入后即可和群友同榜", stored ? "connected" : "neutral");
      renderIdentity();
      if (state.identity) {
        try {
          var me = await api("/v1/identity/me");
          state.identity.publicCode = me.player.publicCode;
          state.identity.nickname = me.player.nickname;
          writeIdentity(state.identity);
          renderIdentity();
        } catch (error) {
          if (error.status === 401 || error.status === 404) { clearIdentity(); renderIdentity(); setConnection("此浏览器的身份凭证已失效；可以使用恢复码找回。", "warning"); }
        }
      }
      await loadBoard("overall");
      var profileCode = new URL(window.location.href).searchParams.get("profile");
      if (profileCode) openPlayer(profileCode);
    } catch (_) {
      state.configured = false;
      state.config = null;
      setConnection("公共榜单暂时无法连接 · 游戏仍可在本机继续", "warning");
      if (empty) { empty.hidden = false; empty.textContent = "榜单服务暂时不可用。本机成绩和三款游戏不受影响。"; }
      renderIdentity();
    }
  }

  tabs.forEach(function (tab) { tab.addEventListener("click", function () { loadBoard(tab.dataset.board); }); });
  byId("ranking-show-register").addEventListener("click", function () {
    byId("ranking-register-form").hidden = false;
    byId("ranking-restore-form").hidden = true;
    ensureCaptchaForVisibleForm("register", "ranking-turnstile-register");
    byId("ranking-register-name").focus();
  });
  byId("ranking-show-restore").addEventListener("click", function () {
    byId("ranking-restore-form").hidden = false;
    byId("ranking-register-form").hidden = true;
    ensureCaptchaForVisibleForm("restore", "ranking-turnstile-restore");
    byId("ranking-recovery-input").focus();
  });
  byId("ranking-show-manage").addEventListener("click", function () {
    byId("ranking-manage-form").hidden = !byId("ranking-manage-form").hidden;
    if (!byId("ranking-manage-form").hidden) ensureCaptchaForVisibleForm("manage", "ranking-turnstile-manage");
  });

  async function ensureCaptchaForVisibleForm(slot, holderId) {
    if (!state.config || localTurnstile() || !state.config.turnstile.siteKey) return;
    try { await prepareCaptchaForContainer(slot, holderId); }
    catch (error) {
      var form = slot === "register" ? byId("ranking-register-form") : slot === "restore" ? byId("ranking-restore-form") : slot === "report" ? byId("public-profile-report-form") : byId("ranking-manage-form");
      setFormMessage(form, error.message);
    }
  }

  async function prepareCaptchaForContainer(slot, holderId) {
    if (state.captchaWidgets[slot] !== undefined) {
      if (window.turnstile) window.turnstile.reset(state.captchaWidgets[slot]);
      return;
    }
    await loadTurnstileScript();
    var holder = byId(holderId);
    state.captchaWidgets[slot] = window.turnstile.render(holder, {
      sitekey: state.config.turnstile.siteKey,
      action: slot === "register" ? "rank_enroll" : slot === "restore" ? "rank_restore" : slot === "report" ? "rank_report" : "rank_manage",
      callback: function (token) { state.captchaTokens[slot] = token; },
      "expired-callback": function () { state.captchaTokens[slot] = ""; },
      "error-callback": function () { state.captchaTokens[slot] = ""; }
    });
  }

  byId("ranking-register-form").addEventListener("submit", enroll);
  byId("ranking-restore-form").addEventListener("submit", restore);
  byId("ranking-change-submit").addEventListener("click", changeNickname);
  byId("ranking-rotate-recovery").addEventListener("click", rotateRecovery);
  byId("ranking-delete").addEventListener("click", deleteIdentity);
  byId("ranking-logout").addEventListener("click", logout);
  byId("public-profile-share").addEventListener("click", function () { if (state.currentProfile) shareProfile(state.currentProfile); });
  byId("public-profile-report-open").addEventListener("click", function () {
    if (!state.identity) { byId("public-profile-report-form").hidden = false; setFormMessage(byId("public-profile-report-form"), "需要先加入一个随机参赛身份才能提交举报；无需提供个人信息。 "); return; }
    byId("public-profile-report-form").hidden = !byId("public-profile-report-form").hidden;
    if (!byId("public-profile-report-form").hidden) ensureCaptchaForVisibleForm("report", "ranking-turnstile-report");
  });
  byId("public-profile-report-form").addEventListener("submit", submitReport);
  byId("recovery-code-ack").addEventListener("change", function () { byId("recovery-code-done").disabled = !byId("recovery-code-ack").checked; });
  byId("recovery-code-dialog").addEventListener("close", function () { byId("recovery-code-value").textContent = ""; });
  byId("recovery-code-done").addEventListener("click", function () { closeDialog("recovery-code-dialog"); byId("recovery-code-value").textContent = ""; });
  byId("recovery-code-copy").addEventListener("click", async function () {
    try { await copyText(byId("recovery-code-value").textContent); byId("recovery-code-copy").textContent = "已复制，请收好"; }
    catch (error) { byId("recovery-code-copy").textContent = error.message || "复制失败"; }
  });

  document.addEventListener("bologna:arcade-game-start", function (event) {
    if (event.detail && GAMES[event.detail.game]) prepareChallenge(event.detail.game);
  });
  document.addEventListener("bologna:arcade-score", submitGameScore);

  state.ready = initialize();
})();
