(function () {
  "use strict";
  var byId = function (id) { return document.getElementById(id); };
  var meta = document.querySelector('meta[name="bologna-ranking-api"]');
  var base = meta ? meta.content.trim().replace(/\/+$/, "") : "";
  var state = { config: null, script: null, tokens: {}, widgets: {} };

  async function api(path, body) {
    var response = await window.fetch(base + path, {
      method: "POST", mode: "cors", credentials: "omit", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    var result = {};
    try { result = await response.json(); } catch (_) { /* Use a generic message for non-JSON errors. */ }
    if (!response.ok) {
      var error = new Error(result.message || "服务暂时不可用，请稍后重试。");
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function setMessage(id, text) { byId(id).textContent = text; }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (state.script) return state.script;
    state.script = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("人机验证组件加载失败；没有提交任何数据，请稍后重试。")); };
      document.head.appendChild(script);
    });
    return state.script;
  }

  async function renderCaptcha(slot, holderId, action) {
    if (state.widgets[slot] !== undefined) {
      window.turnstile.reset(state.widgets[slot]);
      state.tokens[slot] = "";
      return;
    }
    await loadTurnstile();
    state.widgets[slot] = window.turnstile.render(byId(holderId), {
      sitekey: state.config.turnstile.siteKey,
      action: action,
      callback: function (token) { state.tokens[slot] = token; },
      "expired-callback": function () { state.tokens[slot] = ""; },
      "error-callback": function () { state.tokens[slot] = ""; }
    });
  }

  function consumeToken(slot) {
    var token = state.tokens[slot];
    state.tokens[slot] = "";
    if (state.widgets[slot] !== undefined && window.turnstile) window.turnstile.reset(state.widgets[slot]);
    if (!token) throw new Error("请先完成上方的人机验证。");
    return token;
  }

  byId("privacy-request-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = byId("privacy-request-submit");
    button.disabled = true;
    byId("privacy-request-receipt").hidden = true;
    try {
      var result = await api("/v1/privacy-requests", {
        requestType: byId("privacy-request-type").value,
        publicCode: byId("privacy-public-code").value.trim(),
        message: byId("privacy-request-message").value,
        turnstileToken: consumeToken("submit")
      });
      byId("privacy-receipt-code").textContent = result.requestCode;
      byId("privacy-receipt-access").textContent = result.accessCode;
      byId("privacy-request-receipt").hidden = false;
      byId("privacy-request-form").reset();
      setMessage("privacy-request-status", result.message);
    } catch (error) {
      setMessage("privacy-request-status", error.message || "请求未提交；请稍后重试。");
    } finally { button.disabled = false; }
  });

  byId("privacy-check-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = byId("privacy-check-submit");
    button.disabled = true;
    try {
      var result = await api("/v1/privacy-requests/check", {
        requestCode: byId("privacy-check-code").value.trim(),
        accessCode: byId("privacy-check-access").value.trim(),
        turnstileToken: consumeToken("check")
      });
      var statuses = { pending: "已收到，等待处理", in_progress: "处理中", answered: "已有回复", closed: "已结束" };
      setMessage("privacy-check-status", "请求状态：" + (statuses[result.status] || "已更新") + (result.response ? "。控制者回复：" + result.response : "。"));
    } catch (error) {
      setMessage("privacy-check-status", error.message || "暂时无法查询；请核对请求编号和访问码。");
    } finally { button.disabled = false; }
  });

  byId("privacy-copy-receipt").addEventListener("click", async function () {
    var text = "请求编号：" + byId("privacy-receipt-code").textContent + "\n访问码：" + byId("privacy-receipt-access").textContent;
    try {
      await navigator.clipboard.writeText(text);
      byId("privacy-copy-receipt").textContent = "已复制，请妥善保存";
    } catch (_) { setMessage("privacy-request-status", "自动复制失败；请分别长按选择并保存请求编号和访问码。"); }
  });

  async function initialize() {
    if (!base) { setMessage("privacy-request-status", "服务地址未配置，请稍后重试。"); return; }
    try {
      var response = await window.fetch(base + "/v1/config", { mode: "cors", credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("隐私请求服务暂时不可用。");
      state.config = await response.json();
      if (!state.config.turnstile || state.config.turnstile.mode !== "widget" || !state.config.turnstile.siteKey) throw new Error("验证服务尚未配置，暂时不能安全接收请求。");
      await Promise.all([
        renderCaptcha("submit", "privacy-turnstile-submit", "privacy_request"),
        renderCaptcha("check", "privacy-turnstile-check", "privacy_check")
      ]);
      byId("privacy-request-submit").disabled = false;
      byId("privacy-check-submit").disabled = false;
    } catch (error) {
      setMessage("privacy-request-status", error.message || "人机验证服务暂时不可用；请稍后重试。");
      setMessage("privacy-check-status", "查询暂不可用；请稍后重试。");
    }
  }

  initialize();
})();
