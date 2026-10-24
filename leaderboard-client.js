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
  var SUBMISSION_QUEUE_KEY = isStagingPreview
    ? "bologna-students.halloween-ranking.submissions.staging.2026.v1"
    : isLegacyPreview
      ? "bologna-students.halloween-ranking.submissions.preview.v1"
      : "bologna-students.halloween-ranking.submissions.production.v1";
  var SUBMISSION_QUEUE_PREFIX = SUBMISSION_QUEUE_KEY + ".";
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
    identityRevision: 0,
    personalScores: null,
    submissions: [],
    submissionsSupported: false,
    gameSync: {},
    pendingSubmissions: [],
    retryingSubmissions: {},
    memoryIdentity: null,
    ready: null
  };

  var byId = function (id) { return document.getElementById(id); };
  var connection = byId("ranking-connection");
  var list = byId("leaderboard-list");
  var empty = byId("leaderboard-empty");
  var personalRank = byId("personal-rank");
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-board]"));
  var SYNC_GAMES = ["time", "candy", "puzzle"];
  var LOCAL_SCORE_IDS = { time: "record-time", candy: "record-candy", puzzle: "record-puzzle" };
  var PUBLIC_SCORE_IDS = { time: "public-record-time", candy: "public-record-candy", puzzle: "public-record-puzzle" };

  function readSubmissionQueue() {
    try {
      var entries = [];
      for (var index = 0; index < window.localStorage.length; index += 1) {
        var key = window.localStorage.key(index);
        if (!key || key.indexOf(SUBMISSION_QUEUE_PREFIX) !== 0) continue;
        try { entries.push({ key: key, item: JSON.parse(window.localStorage.getItem(key)) }); }
        catch (_) { entries.push({ key: key, item: null }); }
      }
      return entries;
    } catch (_) {
      return [];
    }
  }

  function queueForGame(game) {
    return state.pendingSubmissions.filter(function (item) { return item.game === game; });
  }

  function saveQueuedSubmission(item) {
    if (!state.pendingSubmissions.some(function (queued) { return queued.idempotencyKey === item.idempotencyKey; })) {
      state.pendingSubmissions.push(item);
    }
    try {
      item.persisted = true;
      window.localStorage.setItem(SUBMISSION_QUEUE_PREFIX + item.idempotencyKey, JSON.stringify(item));
      return true;
    } catch (_) {
      item.persisted = false;
      return false;
    }
  }

  function clearQueuedSubmission(item) {
    if (!item || typeof item.idempotencyKey !== "string") return;
    state.pendingSubmissions = state.pendingSubmissions.filter(function (queued) { return queued.idempotencyKey !== item.idempotencyKey; });
    try {
      window.localStorage.removeItem(SUBMISSION_QUEUE_PREFIX + item.idempotencyKey);
    } catch (_) { /* A stale entry remains bounded by its server challenge expiry. */ }
  }

  function clearQueuedSubmissionsForIdentity(publicCode) {
    state.pendingSubmissions.slice().forEach(function (item) {
      if (item.identityCode === publicCode) clearQueuedSubmission(item);
    });
  }

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
    state.identityRevision += 1;
    state.personalScores = null;
    state.submissions = [];
    state.gameSync = {};
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
    var controller = options.timeoutMs && window.AbortController ? new window.AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, options.timeoutMs) : null;
    var response;
    try {
      response = await window.fetch(apiUrl(route), {
        method: options.method || "GET",
        headers: headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
        signal: controller ? controller.signal : undefined
      });
    } catch (error) {
      if (controller && error && error.name === "AbortError") {
        var timeoutError = new Error("排行榜请求超时；本机纪录仍已保存。 ");
        timeoutError.code = "request_timeout";
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timeout !== null) window.clearTimeout(timeout);
    }
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

  function localScoreText(game) {
    var node = byId(LOCAL_SCORE_IDS[game]);
    return node ? node.textContent.trim() : "尚无纪录";
  }

  function formatScore(game, value) {
    if (game === "time") {
      var elapsed = Number(value);
      if (!Number.isFinite(elapsed)) return "成绩格式无效";
      return (elapsed / 1000000).toFixed(2) + " 秒 · ±" + (Math.abs(elapsed - 10000000) / 1000000).toFixed(2);
    }
    if (game === "candy") return Number(value) + " / 20 分";
    return Number(value) > 0 ? "已通关" : "尚未通关";
  }

  function activeOwnReview(game) {
    return state.submissions.find(function (item) { return item.game === game && item.status === "pending"; }) || null;
  }

  function latestOwnSubmission(game) {
    return state.submissions.filter(function (item) { return item.game === game; }).sort(function (left, right) {
      return Number(right.submittedAt || 0) - Number(left.submittedAt || 0);
    })[0] || null;
  }

  function renderGameSync(game) {
    var card = document.querySelector('[data-score-sync="' + game + '"]');
    if (!card) return;
    var publicNode = byId(PUBLIC_SCORE_IDS[game]);
    var score = Array.isArray(state.personalScores) ? state.personalScores.find(function (item) { return item.game === game && item.review_state === "accepted"; }) : null;
    if (publicNode) {
      if (!state.configured) publicNode.textContent = "榜单暂不可用";
      else if (!state.identity) publicNode.textContent = "加入后显示";
      else if (state.personalScores === null) publicNode.textContent = "查询中…";
      else publicNode.textContent = score ? formatScore(game, score.best_value) : "暂无公开成绩";
    }

    var status = state.gameSync[game] || null;
    var queuedItems = queueForGame(game);
    var matchingQueued = state.identity ? queuedItems.filter(function (item) { return item.identityCode === state.identity.publicCode; }) : [];
    var queued = matchingQueued[0] || queuedItems[0] || null;
    var retryableItems = matchingQueued.filter(function (item) { return validQueuedSubmission(game, item) && Number(item.expiresAt) > Date.now(); });
    var expiredQueueCount = matchingQueued.length - retryableItems.length;
    if (queuedItems.length && state.identity && !matchingQueued.length) {
      status = { key: "mismatch", message: "待确认成绩属于另一公共编号。请恢复对应身份后再提交；原凭证已保留。" };
    } else if (matchingQueued.length) {
      var otherIdentityQueueCount = queuedItems.length - matchingQueued.length;
      var volatileQueueCount = retryableItems.filter(function (item) { return item.persisted === false; }).length;
      var expiredCheckedCount = matchingQueued.filter(function (item) { return Number(item.expiresAt) <= Date.now() && item.receiptCheckedAt; }).length;
      status = { key: "failed", message: retryableItems.length
        ? (volatileQueueCount === retryableItems.length
          ? "有 " + volatileQueueCount + " 条结果尚未确认；队列只在当前页面内存中，可留在此页安全重试，刷新或关闭后无法恢复。"
          : "有 " + retryableItems.length + " 条提交结果尚未确认；已持久保存的项目可沿用原挑战和幂等编号安全重试。" + (volatileQueueCount ? " 另有 " + volatileQueueCount + " 条仅在当前页面内存中。" : "")) + (expiredQueueCount ? " 另有 " + expiredQueueCount + " 条凭证已过期，正在核对服务器回执，不会再次提交。" : "")
        : (expiredCheckedCount
          ? "个人状态接口暂未返回这条提交的服务器回执；挑战凭证已失效，不能自动补交，也无法据此断定请求从未到达。本机成绩仍保留。"
          : "挑战凭证已过期，正在核对服务器是否收到原提交；不会重放失效凭证。本机成绩仍保留。") };
      if (otherIdentityQueueCount) status.message += " 另有其他编号的待确认成绩保留在此浏览器。";
    } else if (queued && !state.identity) {
      status = { key: "mismatch", message: "有一局成绩待确认，属于编号 " + queued.identityCode + "。请用恢复码找回该身份后再重试。" };
    } else if (state.identity && !status) {
      var review = activeOwnReview(game);
      var latest = latestOwnSubmission(game);
      if (state.personalScores === null) status = { key: "preparing", message: "正在核对当前公共编号的个人成绩…" };
      else if (review) status = { key: "pending", message: "服务器已收到 " + formatScore(game, review.value) + "，正在人工审核；公开榜暂时保留此前最佳。" };
      else if (latest && latest.status === "approved") status = { key: "published", message: "最近一次成绩已通过审核。公共榜单显示当前公开最佳。" };
      else if (latest && latest.status === "rejected") status = { key: "failed", message: "最近一次候选成绩未通过审核；此前公开最佳记录保留。" };
      else if (score) status = { key: "published", message: "当前浏览器连接到公共编号 " + state.identity.publicCode + "。" };
      else if (localScoreText(game) !== "尚无纪录" && localScoreText(game) !== "尚未通关") status = { key: "local", message: "本机有纪录；公共榜尚无对应成绩。开始新局前会申请本局挑战凭证。" };
      else status = { key: "idle", message: "公共身份已连接；本机最佳与公共最佳分别显示。" };
    } else if (!state.identity && !status) {
      status = { key: "local", message: localScoreText(game) === "尚无纪录" || localScoreText(game) === "尚未通关"
        ? "尚未加入公共榜；游戏可以照常玩。"
        : "本机保存，尚未提交。加入前取得的本机成绩没有服务器挑战凭证，不能直接补交。" };
    }

    var statusNode = byId("sync-status-" + game);
    if (statusNode) statusNode.textContent = status ? status.message : "本机成绩与公共榜单分开保存。";
    card.dataset.state = status ? status.key : "idle";
    var retry = card.querySelector("[data-retry-score]");
    if (retry) { retry.hidden = !retryableItems.length; retry.disabled = !!(state.retryingSubmissions[game]); }
  }

  function renderAllGameSync() { SYNC_GAMES.forEach(renderGameSync); }

  function applyOwnScoreData(data) {
    state.personalScores = Array.isArray(data && data.scores) ? data.scores : [];
    state.submissionsSupported = !!(data && data.submissionsVersion === 1 && Array.isArray(data.submissions));
    if (state.submissionsSupported) state.submissions = data.submissions;
    var expiredWithoutReceipt = {};
    if (state.submissionsSupported) {
      state.pendingSubmissions.slice().forEach(function (queued) {
        var receipt = state.submissions.find(function (item) { return item.submissionId === queued.idempotencyKey; });
        if (receipt) clearQueuedSubmission(queued);
        else if (Date.now() >= Number(queued.expiresAt)) {
          queued.receiptCheckedAt = Date.now();
          saveQueuedSubmission(queued);
          expiredWithoutReceipt[queued.game] = true;
        }
      });
    }
    SYNC_GAMES.forEach(function (game) {
      var review = activeOwnReview(game);
      var latest = latestOwnSubmission(game);
      if (review) state.gameSync[game] = { key: "pending", message: "服务器已收到 " + formatScore(game, review.value) + "，正在人工审核；公开榜暂时保留此前最佳。" };
      else if (latest && latest.status === "approved") state.gameSync[game] = { key: "published", message: "最近一次成绩已通过审核。公共榜单显示当前公开最佳。" };
      else if (latest && latest.status === "rejected") state.gameSync[game] = { key: "failed", message: "最近一次候选成绩未通过审核；此前公开最佳记录保留。" };
      else if (!state.submissionsSupported && state.gameSync[game] && state.gameSync[game].key === "pending") { /* Keep the last confirmed pending receipt on an older API version. */ }
      else if (state.personalScores.some(function (score) { return score.game === game && score.review_state === "accepted"; })) state.gameSync[game] = { key: "published", message: "当前公共最佳已通过规则核验或人工审核。" };
      else state.gameSync[game] = null;
      if (expiredWithoutReceipt[game]) state.gameSync[game] = { key: "failed", message: "服务器个人回执中没有找到这次提交，且挑战凭证已过期；没有自动补交。本机成绩仍保留，请通过新一局取得有效凭证。" };
    });
    renderAllGameSync();
  }

  async function refreshOwnScoreData() {
    if (!state.identity || !state.configured) return null;
    var data = await api("/v1/identity/me");
    if (!state.identity || data.player.publicCode !== state.identity.publicCode) {
      state.gameSync = {};
      setConnection("公共身份与当前资料不一致；请用恢复码恢复正确编号。", "warning");
      renderAllGameSync();
      return null;
    }
    state.identity.nickname = data.player.nickname;
    writeIdentity(state.identity);
    applyOwnScoreData(data);
    return data;
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
      state.identityRevision += 1;
      state.personalScores = [];
      state.submissions = [];
      state.gameSync = {};
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
      try { await refreshOwnScoreData(); } catch (_) { renderAllGameSync(); }
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
      state.identityRevision += 1;
      state.personalScores = null;
      state.submissions = [];
      state.gameSync = {};
      byId("ranking-recovery-input").value = "";
      setConnection(stored ? "身份已恢复 · 此浏览器现已与原成绩关联" : "身份已恢复 · 本机存储不可用，请重新保存恢复码", stored ? "connected" : "warning");
      renderIdentity();
      await reloadBoard();
      try { await refreshOwnScoreData(); } catch (_) { renderAllGameSync(); }
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
      clearQueuedSubmissionsForIdentity(state.identity && state.identity.publicCode);
      clearIdentity();
      state.challenges = {};
      renderIdentity();
      renderAllGameSync();
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
    renderAllGameSync();
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

  function challengeFailureIsRetryable(error) {
    return !error.status || error.status === 408 || error.status === 429 || error.status >= 500 || error.code === "request_timeout";
  }

  function prepareChallenge(game) {
    var identityRevision = state.identityRevision;
    var task = (async function () {
      if (state.ready) await Promise.race([state.ready, new Promise(function (resolve) { window.setTimeout(resolve, 7000); })]);
      if (!state.configured) {
        state.gameSync[game] = { key: "failed", message: "公共榜单暂时不可用；本机成绩仍会保存，本局不会进入公共榜。" };
        renderGameSync(game);
        return { eligible: false, reason: "offline" };
      }
      if (!state.identity) {
        state.gameSync[game] = { key: "local", message: "本局开始时未加入公共榜；本机纪录会保存，但没有本局服务器凭证。" };
        renderGameSync(game);
        return { eligible: false, reason: "not-enrolled" };
      }
      if (identityRevision !== state.identityRevision) {
        state.gameSync[game] = { key: "mismatch", message: "本局开始后公共身份发生变化；为保护成绩归属，本局只保存到本机。" };
        renderGameSync(game);
        return { eligible: false, reason: "identity-changed" };
      }
      if (queueForGame(game).some(function (item) { return Number(item.expiresAt) > Date.now(); })) {
        state.gameSync[game] = { key: "failed", message: "上一局仍有有效提交待确认。请先安全重试，再开始新的公共榜挑战。" };
        renderGameSync(game);
        return { eligible: false, reason: "submission-pending" };
      }
      var identityCode = state.identity.publicCode;
      state.gameSync[game] = { key: "preparing", message: "正在为本局获取公共榜挑战凭证…" };
      renderGameSync(game);
      var challenge = null;
      var lastError = null;
      for (var attempt = 0; attempt < 2; attempt += 1) {
        try {
          challenge = await api("/v1/challenges", { method: "POST", body: { game: game }, timeoutMs: 5000 });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt || !challengeFailureIsRetryable(error)) break;
          await new Promise(function (resolve) { window.setTimeout(resolve, 350); });
        }
      }
      if (identityRevision !== state.identityRevision || !state.identity || state.identity.publicCode !== identityCode) {
        state.gameSync[game] = { key: "mismatch", message: "本局开始后公共身份发生变化；挑战凭证不会转给另一个身份。" };
        renderGameSync(game);
        return { eligible: false, reason: "identity-changed" };
      }
      if (!challenge || challenge.game !== game || typeof challenge.sessionId !== "string" || typeof challenge.challenge !== "string" || !Number.isFinite(Number(challenge.expiresAt))) {
        state.gameSync[game] = { key: "failed", message: "本局未取得有效服务器挑战凭证；本机纪录仍保存，不能把它直接补录到公共榜。" };
        renderGameSync(game);
        return { eligible: false, reason: "challenge-unavailable", error: lastError };
      }
      state.gameSync[game] = { key: "ready", message: "本局挑战凭证已就绪；结束后会显示提交、公开或审核状态。" };
      renderGameSync(game);
      return { eligible: true, identityCode: identityCode, challenge: challenge };
    })();
    state.challenges[game] = task;
    return task;
  }

  function validQueuedSubmission(game, item) {
    return !!item && typeof item === "object" && item.game === game &&
      typeof item.identityCode === "string" && /^BS-[0-9A-HJKMNP-TV-Z]{8}$/.test(item.identityCode) &&
      item.challenge && item.challenge.game === game && typeof item.challenge.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(item.challenge.sessionId) && typeof item.challenge.challenge === "string" &&
      Number.isFinite(Number(item.expiresAt)) && item.payload && typeof item.payload === "object" && item.payload.game === game &&
      Number(item.challenge.expiresAt) === Number(item.expiresAt) &&
      item.payload.sessionId === item.challenge.sessionId && item.payload.challenge === item.challenge.challenge &&
      item.idempotencyKey === item.challenge.sessionId;
  }

  function restoreSubmissionQueue() {
    state.pendingSubmissions = [];
    readSubmissionQueue().forEach(function (entry) {
      var game = entry.item && entry.item.game;
      var item = entry.item;
      var keyMatches = item && item.idempotencyKey && entry.key === SUBMISSION_QUEUE_PREFIX + item.idempotencyKey;
      if (!SYNC_GAMES.includes(game) || !keyMatches || !validQueuedSubmission(game, item)) {
        try { window.localStorage.removeItem(entry.key); } catch (_) { /* It will be ignored again on the next load. */ }
        if (SYNC_GAMES.includes(game)) state.gameSync[game] = { key: "failed", message: "上次待重试请求无法安全校验；本机最佳仍保留，请重新开始一局。" };
      } else {
        item.persisted = true;
        state.pendingSubmissions.push(item);
        if (Date.now() >= Number(item.expiresAt)) state.gameSync[game] = { key: "failed", message: "上次挑战凭证已过期；正在核对服务器回执，不会重放失效凭证。本机最佳仍保留。" };
      }
    });
  }

  async function sendQueuedSubmission(game, item) {
    if (state.retryingSubmissions[game]) return false;
    if (!validQueuedSubmission(game, item)) {
      clearQueuedSubmission(item);
      state.gameSync[game] = { key: "failed", message: "待重试数据无法通过本机格式检查；本机纪录仍保留，请重新开始一局。" };
      renderGameSync(game);
      return false;
    }
    if (!state.identity || state.identity.publicCode !== item.identityCode) {
      state.gameSync[game] = { key: "mismatch", message: "这条待重试成绩属于编号 " + item.identityCode + "。请在当前浏览器恢复该编号后再试。" };
      renderGameSync(game);
      return false;
    }
    if (Date.now() >= Number(item.expiresAt)) {
      state.gameSync[game] = { key: "failed", message: "本局挑战凭证已过期，系统没有重放它；正在核对服务器回执。本机最佳仍保留。" };
      renderGameSync(game);
      return false;
    }

    state.gameSync[game] = { key: "uploading", message: "正在向公共榜单提交本机最佳成绩…" };
    state.retryingSubmissions[game] = true;
    renderGameSync(game);
    try {
      var result = await api("/v1/scores", {
        method: "POST",
        body: item.payload,
        headers: { "Idempotency-Key": item.idempotencyKey },
        timeoutMs: 12000
      });
      clearQueuedSubmission(item);
      if (result.pendingReview) {
        state.gameSync[game] = { key: "pending", message: "服务器已收到 " + formatScore(game, result.submittedValue) + "，正在人工审核；旧的公开最佳暂时继续显示。" };
      } else {
        state.gameSync[game] = { key: "published", message: "服务器已接收并核验本次提交。公共最佳：" + (result.bestValue === null ? "暂无" : formatScore(game, result.bestValue)) + "。" };
      }
      renderGameSync(game);
      setRankStatus(result.message || (result.pendingReview ? "成绩已收到，正在人工审核；公开榜暂时保留此前最佳。" : "成绩提交已核验。"));
      try { await refreshOwnScoreData(); } catch (_) { /* Keep the submission receipt visible if the follow-up read is offline. */ }
      if (!result.pendingReview) await reloadBoard();
      state.retryingSubmissions[game] = false;
      renderGameSync(game);
      return true;
    } catch (error) {
      var permanentClientError = error && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 408 && error.status !== 429;
      if (error && (permanentClientError || error.code === "challenge_used" || error.code === "challenge_required" || error.code === "invalid_result" || error.code === "season_read_only")) {
        clearQueuedSubmission(item);
        state.gameSync[game] = { key: "failed", message: "服务器无法接受这份挑战凭证；没有重放或更改成绩。本机纪录仍保留，请新开一局。" };
      } else {
        var persisted = saveQueuedSubmission(item);
        state.gameSync[game] = { key: "failed", message: persisted
          ? "提交结果尚未确认；已在此浏览器安全保留同一凭证与幂等编号，可重试而不会重复计分。"
          : "提交结果尚未确认；仅当前页面内存保留了原请求。请留在此页并重试，刷新或关闭后无法恢复提交。" };
      }
      renderGameSync(game);
      setRankStatus("本机纪录已保存；公共榜单状态：" + (error.message || "网络暂时不可用，可安全重试。"));
      state.retryingSubmissions[game] = false;
      renderGameSync(game);
      return false;
    }
  }

  async function retryQueuedSubmission(game, skipReadyWait) {
    var items = queueForGame(game).filter(function (item) { return Number(item.expiresAt) > Date.now(); });
    if (!items.length) return;
    if (!skipReadyWait && state.ready) await state.ready;
    var results = [];
    for (var i = 0; i < items.length; i += 1) results.push(await sendQueuedSubmission(game, items[i]));
    return results.every(Boolean);
  }

  async function submitGameScore(event) {
    var game = event.detail && event.detail.game;
    var body = event.detail && event.detail.result;
    if (!GAMES[game]) return;
    if (!state.configured) {
      state.gameSync[game] = { key: "failed", message: "本机最佳已保存；排行榜服务不可用，当前没有公共提交。" };
      renderGameSync(game);
      return;
    }
    if (!state.identity) {
      state.gameSync[game] = { key: "local", message: "本机最佳已保存，尚未提交。加入公共榜前完成的这局没有服务器挑战凭证，不能直接补交。" };
      renderGameSync(game);
      return;
    }
    var challengeTask = state.challenges[game];
    delete state.challenges[game];
    var prepared = challengeTask ? await challengeTask : null;
    if (!prepared || !prepared.eligible) {
      if (!state.gameSync[game]) state.gameSync[game] = { key: "failed", message: "本机最佳已保存；本局没有可用的公共挑战凭证。" };
      renderGameSync(game);
      return;
    }
    if (!state.identity || state.identity.publicCode !== prepared.identityCode) {
      state.gameSync[game] = { key: "mismatch", message: "本局公共身份与当前身份不一致；为避免成绩归错人，本局不会上传。" };
      renderGameSync(game);
      return;
    }
    if (queueForGame(game).some(function (item) { return Number(item.expiresAt) > Date.now(); })) {
      state.gameSync[game] = { key: "failed", message: "上一局提交仍待确认，系统保留了原成绩与幂等编号；请先重试上一局。" };
      renderGameSync(game);
      return;
    }
    var payload = Object.assign({}, body, { game: game, sessionId: prepared.challenge.sessionId, challenge: prepared.challenge.challenge });
    var envelope = {
      game: game,
      identityCode: prepared.identityCode,
      challenge: prepared.challenge,
      payload: payload,
      idempotencyKey: prepared.challenge.sessionId,
      expiresAt: Number(prepared.challenge.expiresAt)
    };
    var persisted = saveQueuedSubmission(envelope);
    if (!persisted) state.gameSync[game] = { key: "failed", message: "本机最佳已保存，但浏览器禁止持久化待提交队列；本次若遇网络中断，关闭页面后无法恢复上传。" };
    await sendQueuedSubmission(game, envelope);
  }

  var GAMES = { time: true, candy: true, puzzle: true };

  function reloadBoard() { return loadBoard(state.board); }

  async function initialize() {
    restoreSubmissionQueue();
    if (!API_BASE) {
      setConnection("本机记录模式 · 公共榜单服务尚未连接", "neutral");
      if (empty) { empty.hidden = false; empty.textContent = "当前只保存本机纪录。公共排行榜需等待独立 Worker、D1 与验证服务获批配置；不影响游戏。"; }
      renderIdentity();
      renderAllGameSync();
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
      if (stored) renderAllGameSync();
      if (state.identity) {
        try {
          var me = await api("/v1/identity/me");
          state.identity.publicCode = me.player.publicCode;
          state.identity.nickname = me.player.nickname;
          writeIdentity(state.identity);
          renderIdentity();
          applyOwnScoreData(me);
        } catch (error) {
          if (error.status === 401 || error.status === 404) { clearIdentity(); renderIdentity(); setConnection("此浏览器的身份凭证已失效；可以使用恢复码找回。", "warning"); }
          else state.gameSync = {};
        }
      }
      await loadBoard("overall");
      renderAllGameSync();
      var profileCode = new URL(window.location.href).searchParams.get("profile");
      if (profileCode) openPlayer(profileCode);
      if (state.identity) SYNC_GAMES.forEach(function (game) {
        if (queueForGame(game).some(function (item) { return item.identityCode === state.identity.publicCode && Number(item.expiresAt) > Date.now(); })) retryQueuedSubmission(game, true);
      });
    } catch (_) {
      state.configured = false;
      state.config = null;
      setConnection("公共榜单暂时无法连接 · 游戏仍可在本机继续", "warning");
      if (empty) { empty.hidden = false; empty.textContent = "榜单服务暂时不可用。本机成绩和三款游戏不受影响。"; }
      renderIdentity();
      renderAllGameSync();
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
    if (event.detail && GAMES[event.detail.game]) event.detail.challengeReady = prepareChallenge(event.detail.game);
  });
  document.addEventListener("bologna:arcade-score", submitGameScore);
  Array.prototype.forEach.call(document.querySelectorAll("[data-retry-score]"), function (button) {
    button.addEventListener("click", function () { retryQueuedSubmission(button.getAttribute("data-retry-score")); });
  });
  window.addEventListener("online", function () {
    SYNC_GAMES.forEach(function (game) { if (queueForGame(game).length) retryQueuedSubmission(game); });
    if (state.identity && SYNC_GAMES.some(function (game) { return queueForGame(game).some(function (item) { return Number(item.expiresAt) <= Date.now(); }); })) refreshOwnScoreData().catch(function () { /* Keep the unresolved receipt visible while offline. */ });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (state.identity) SYNC_GAMES.forEach(function (game) { if (queueForGame(game).length) retryQueuedSubmission(game); });
    var needsOwnRefresh = state.submissions.some(function (item) { return item.status === "pending"; }) || SYNC_GAMES.some(function (game) { return queueForGame(game).some(function (item) { return Number(item.expiresAt) <= Date.now(); }); });
    if (!state.identity || !needsOwnRefresh) return;
    var wasPending = true;
    refreshOwnScoreData().then(function () {
      if (wasPending && !state.submissions.some(function (item) { return item.status === "pending"; })) loadBoard(state.board);
    }).catch(function () { /* Keep the last confirmed review state visible while offline. */ });
  });
  window.setInterval(function () {
    var needsOwnRefresh = state.submissions.some(function (item) { return item.status === "pending"; }) || SYNC_GAMES.some(function (game) { return queueForGame(game).some(function (item) { return Number(item.expiresAt) <= Date.now(); }); });
    if (document.hidden || !state.identity || !needsOwnRefresh) return;
    refreshOwnScoreData().then(function () {
      if (!state.submissions.some(function (item) { return item.status === "pending"; })) loadBoard(state.board);
    }).catch(function () { /* Review status remains the last server-confirmed state. */ });
  }, 60000);

  window.addEventListener("storage", function (event) {
    if (event.key !== null && event.key.indexOf(SUBMISSION_QUEUE_PREFIX) !== 0) return;
    restoreSubmissionQueue();
    renderAllGameSync();
    if (state.identity) {
      refreshOwnScoreData().catch(function () { /* Keep local receipt state if the API is offline. */ });
      SYNC_GAMES.forEach(function (game) { if (queueForGame(game).length) retryQueuedSubmission(game); });
    }
  });

  state.ready = initialize();
})();
