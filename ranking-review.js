(function () {
  "use strict";
  var apiMeta = document.querySelector('meta[name="bologna-ranking-api"]');
  var API = apiMeta ? apiMeta.content.trim().replace(/\/+$/, "") : "";
  var token = "";
  var authPanel = document.getElementById("auth-panel");
  var app = document.getElementById("review-app");
  var authForm = document.getElementById("auth-form");
  var tokenInput = document.getElementById("admin-token");
  var authFeedback = document.getElementById("auth-feedback");
  var feedback = document.getElementById("queue-feedback");
  var writeToggle = document.getElementById("enable-writes");
  var REVIEW_REASON_OPTIONS = [
    ["score_consistent", "服务端规则重算一致"],
    ["duplicate_fingerprint_reviewed", "重复事件指纹已复核"],
    ["reported_value_mismatch", "客户端与服务端分值不一致"],
    ["challenge_integrity_issue", "挑战凭证完整性异常"],
    ["abuse_confirmed", "有独立证据确认滥用"],
    ["insufficient_evidence", "证据不足，继续待审"],
    ["other", "其他（需填写说明）"]
  ];
  var REASON_LABELS = {
    exceptional_time: "旧版高精度成绩阈值（不代表作弊）",
    perfect_candy: "旧版满分阈值（不代表作弊）",
    automated_rule: "独立完整性信号",
    reported_value_mismatch: "客户端与服务端分值不一致",
    duplicate_event_fingerprint: "24小时内重复的完整事件指纹",
    score_consistent: "服务端规则重算一致",
    duplicate_fingerprint_reviewed: "重复事件指纹已复核",
    challenge_integrity_issue: "挑战凭证完整性异常",
    abuse_confirmed: "有独立证据确认滥用",
    insufficient_evidence: "证据不足，继续待审",
    other: "其他"
  };

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function safeDate(value) {
    if (!value) return "暂无";
    var date = new Date(Number(value));
    return Number.isNaN(date.getTime()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  function ageLabel(value) {
    if (!value) return "无待审记录";
    var minutes = Math.max(0, Math.floor((Date.now() - Number(value)) / 60000));
    if (minutes < 60) return minutes + " 分钟";
    var hours = Math.floor(minutes / 60);
    if (hours < 48) return hours + " 小时";
    return Math.floor(hours / 24) + " 天";
  }
  function scoreLabel(item) {
    if (item.game === "time") {
      var seconds = Number(item.candidate_value) / 1000000;
      return seconds.toFixed(4) + " 秒 · 偏差 " + (Math.abs(seconds - 10)).toFixed(4) + " 秒";
    }
    if (item.game === "candy") return Number(item.candidate_value) + " / 20 分";
    return Number(item.candidate_value) === 1 ? "谜团已通关" : "未知成绩";
  }
  function gameLabel(game) { return ({ time: "午夜十秒", candy: "糖果投篮", puzzle: "万圣谜团" })[game] || game; }
  function reasonLabel(reason) { return REASON_LABELS[reason] || reason || "未提供原因"; }
  function evidenceFor(item) {
    var parsed;
    try { parsed = JSON.parse(item.detail_json || "{}"); } catch (_) { return "证据格式无法解析；不要据此自动批准或驳回。"; }
    if (Array.isArray(parsed)) return "旧版三次计时尝试（秒）：" + parsed.map(function (value) { return (Number(value) / 1000000).toFixed(4); }).join("、");
    if (parsed && Array.isArray(parsed.attemptsUs)) return "三次计时尝试（秒）：" + parsed.attemptsUs.map(function (value) { return (Number(value) / 1000000).toFixed(4); }).join("、") + "\n" + JSON.stringify(parsed, null, 2);
    return JSON.stringify(parsed, null, 2);
  }
  function basisFor(item) {
    if (item.reason_code === "exceptional_time") return "旧版规则仅因误差小于 20 毫秒送审。核对三次尝试与服务端最佳值；高分本身不是异常证据。";
    if (item.reason_code === "perfect_candy") return "旧版规则仅因 20/20 送审。服务端当时按 10 次提交事件重新计算；历史行未保存逐球时间，因此无法事后逐球复算。这一资料限制不是驳回理由。";
    var parsed;
    try { parsed = JSON.parse(item.detail_json || "{}"); } catch (_) { parsed = null; }
    var signals = parsed && Array.isArray(parsed.reviewSignals) ? parsed.reviewSignals : [];
    return signals.length ? "独立信号：" + signals.map(reasonLabel).join("；") + "。逐项核实后再作决定。" : "没有可识别的独立异常信号。核对下方留存数据；资料不足时保留待审。";
  }
  async function api(path, options) {
    var requestOptions = options || {};
    var headers = new Headers(requestOptions.headers || {});
    headers.set("Authorization", "Bearer " + token);
    headers.set("Accept", "application/json");
    if (requestOptions.body !== undefined) headers.set("Content-Type", "application/json");
    var response = await fetch(API + path, {
      method: requestOptions.method || "GET",
      headers: headers,
      body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.message || "请求失败（HTTP " + response.status + "）。");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function renderSummary(summary) {
    var target = document.getElementById("review-summary");
    target.replaceChildren();
    var cards = [
      [String(summary.pendingCount || 0), "当前待审核总数"],
      [ageLabel(summary.oldestPendingAt), "最久等待"],
      [safeDate(summary.oldestPendingAt), "最早提交（Europe/Rome）"]
    ];
    cards.forEach(function (item) {
      var card = element("div", "summary-card");
      card.append(element("strong", "", item[0]), element("span", "", item[1]));
      target.append(card);
    });
    document.getElementById("queue-count").textContent = (summary.pendingCount || 0) + " 条";

    var breakdown = document.getElementById("review-breakdown");
    breakdown.replaceChildren();
    (summary.byGameAndReason || []).forEach(function (row) {
      var item = element("div", "breakdown-item");
      item.append(element("strong", "", gameLabel(row.game) + " · " + reasonLabel(row.reasonCode)));
      item.append(element("span", "", row.count + " 条；最早 " + safeDate(row.oldestAt)));
      breakdown.append(item);
    });
    if (!breakdown.childElementCount) breakdown.append(element("p", "empty", "目前没有待审核记录。"));
  }
  function renderReviewGroups(reviews) {
    var host = document.getElementById("review-groups");
    host.replaceChildren();
    if (!reviews.length) { host.append(element("p", "empty", "目前没有待审核成绩。")); return; }
    var groups = new Map();
    reviews.forEach(function (item) {
      if (!groups.has(item.public_code)) groups.set(item.public_code, { nickname: item.nickname, items: [] });
      groups.get(item.public_code).items.push(item);
    });
    groups.forEach(function (group, publicCode) {
      var section = element("section", "player-group");
      var heading = element("h3", "", group.nickname || "未命名玩家");
      heading.append(element("small", "", publicCode + " · " + group.items.length + " 条待审核"));
      section.append(heading);
      group.items.forEach(function (item) { section.append(renderReviewItem(item)); });
      host.append(section);
    });
  }
  function renderReviewItem(item) {
    var card = element("article", "review-card");
    var title = element("h4", "", gameLabel(item.game) + " · " + scoreLabel(item));
    var submitted = element("p", "review-meta", "提交：" + safeDate(item.created_at) + " · 原因：" + reasonLabel(item.reason_code));
    var basis = element("p", "basis", basisFor(item));
    var evidence = element("pre", "evidence", evidenceFor(item));
    var form = element("div", "actions");
    var reasonLabelNode = element("label", "reason", "处理依据");
    var select = document.createElement("select");
    select.setAttribute("aria-label", "处理依据");
    REVIEW_REASON_OPTIONS.forEach(function (option) {
      var entry = document.createElement("option"); entry.value = option[0]; entry.textContent = option[1]; select.append(entry);
    });
    reasonLabelNode.append(select);
    var noteLabel = element("label", "note", "补充说明（请勿填写个人敏感信息）");
    var note = document.createElement("textarea"); note.maxLength = 500; noteLabel.append(note);
    var approve = element("button", "", "批准并按原规则更新最佳");
    var reject = element("button", "secondary", "驳回此候选");
    var defer = element("button", "secondary", "保持待审");
    var actions = [approve, reject, defer];
    function syncControls() {
      var enabled = !!writeToggle.checked;
      actions.forEach(function (button) { button.disabled = !enabled; });
      var needsNote = select.value === "other";
      approve.disabled = !enabled || needsNote && !note.value.trim();
      reject.disabled = !enabled || needsNote && !note.value.trim();
      defer.disabled = false;
    }
    select.addEventListener("change", syncControls); note.addEventListener("input", syncControls); writeToggle.addEventListener("change", syncControls);
    defer.addEventListener("click", function () { feedback.textContent = "记录仍保留在待审核队列；没有写入。"; });
    async function handle(action) {
      if (!writeToggle.checked) return;
      var reasonCode = select.value;
      if (reasonCode === "insufficient_evidence") { feedback.textContent = "证据不足时请保持待审，不要批准或驳回。"; return; }
      if (action === "approve" && ["challenge_integrity_issue", "abuse_confirmed"].includes(reasonCode)) { feedback.textContent = "该依据与批准决定冲突；请先复核证据或保持待审。"; return; }
      if (action === "reject" && reasonCode === "score_consistent") { feedback.textContent = "服务端规则重算一致不能作为驳回依据；请保持待审或选择有证据支持的原因。"; return; }
      if (reasonCode === "other" && !note.value.trim()) { feedback.textContent = "选择“其他”时必须填写简短依据。"; note.focus(); return; }
      var actionText = action === "approve" ? "批准" : "驳回";
      if (!window.confirm("确认" + actionText + "「" + (item.nickname || item.public_code) + "」的「" + gameLabel(item.game) + "」候选 " + scoreLabel(item) + "？该操作会更新真实队列并留下审计记录。")) return;
      approve.disabled = true; reject.disabled = true; defer.disabled = true;
      try {
        await api("/v1/admin/reviews/" + encodeURIComponent(item.id), { method: "POST", body: { action: action, reasonCode: reasonCode, reasonDetail: note.value.trim() } });
        feedback.textContent = actionText + "完成，正在刷新队列。";
        await loadQueue();
      } catch (error) {
        feedback.textContent = error.status === 404 || error.status === 409 ? "此记录已被处理或已变化；已尝试刷新，请按最新队列复核。" : error.message;
        if (error.status === 401) disconnect(); else await loadQueue().catch(function () {});
      }
    }
    approve.addEventListener("click", function () { handle("approve"); });
    reject.addEventListener("click", function () { handle("reject"); });
    syncControls();
    form.append(reasonLabelNode, noteLabel, approve, reject, defer);
    card.append(title, submitted, basis, evidence, form);
    return card;
  }
  async function loadQueue() {
    feedback.textContent = "正在读取队列…";
    var data = await api("/v1/admin/queue");
    renderSummary(data.reviewSummary || { pendingCount: (data.reviews || []).length });
    renderReviewGroups(data.reviews || []);
    feedback.textContent = "队列已更新；所有记录按最早提交优先显示。";
  }
  function disconnect() {
    token = "";
    tokenInput.value = "";
    writeToggle.checked = false;
    app.hidden = true;
    authPanel.hidden = false;
    authFeedback.textContent = "连接已断开，页面内令牌已清除。";
  }
  authForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!API) { authFeedback.textContent = "页面没有配置排行榜 API。"; return; }
    token = tokenInput.value;
    tokenInput.value = "";
    authFeedback.textContent = "正在验证管理员权限…";
    try {
      await loadQueue();
      authPanel.hidden = true;
      app.hidden = false;
    } catch (error) {
      token = "";
      authFeedback.textContent = error.status === 401 ? "管理员权限验证失败。" : error.message;
    }
  });
  document.getElementById("refresh-queue").addEventListener("click", function () { loadQueue().catch(function (error) { feedback.textContent = error.message; }); });
  document.getElementById("logout").addEventListener("click", disconnect);
  window.addEventListener("pagehide", function () { token = ""; });
}());
