(function () {
  "use strict";
  var base = document.querySelector('meta[name="bologna-ranking-api"]').content.trim().replace(/\/+$/, "");
  var token = "";
  var queue = document.getElementById("privacy-request-queue");
  var status = document.getElementById("admin-status");
  var labels = { access: "访问数据", rectification: "更正数据", erasure: "删除数据", restriction: "限制处理", objection: "反对处理", portability: "数据可携", withdraw_consent: "撤回同意", other: "其他隐私问题" };

  function request(path, method, body) {
    var headers = { Authorization: "Bearer " + token };
    var options = { method: method || "GET", mode: "cors", credentials: "omit", cache: "no-store", headers: headers };
    if (body !== undefined) { headers["Content-Type"] = "application/json"; options.body = JSON.stringify(body); }
    return window.fetch(base + path, options).then(async function (response) {
      var data = {};
      try { data = await response.json(); } catch (_) { /* Do not print request data or token. */ }
      if (!response.ok) { var error = new Error(data.message || "授权失败或服务暂不可用。"); error.status = response.status; throw error; }
      return data;
    });
  }

  function addText(parent, tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value || "";
    parent.appendChild(node);
    return node;
  }

  async function loadQueue() {
    queue.replaceChildren();
    var result = await request("/v1/admin/privacy-requests");
    var rows = result.requests || [];
    if (!rows.length) { addText(queue, "p", "form-message", "当前没有待处理的隐私请求。"); return; }
    rows.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "privacy-queue-item";
      addText(card, "h3", "", (labels[item.request_type] || "隐私请求") + " · " + item.request_code);
      addText(card, "p", "", "提交时间：" + new Date(item.created_at).toLocaleString() + (item.public_code ? " · 参赛编号：" + item.public_code : ""));
      addText(card, "p", "request-body", item.message || "没有补充说明。");
      var reply = document.createElement("textarea");
      reply.maxLength = 1200;
      reply.rows = 3;
      reply.setAttribute("aria-label", "给请求者的私密回复");
      reply.placeholder = "需要回复时输入最多 1200 字；将通过请求者的访问码私密显示。";
      card.appendChild(reply);
      var actions = document.createElement("div");
      actions.className = "identity-actions";
      [
        { label: "标记处理中", status: "in_progress", needsReply: false },
        { label: "发送回复并完成", status: "answered", needsReply: true },
        { label: "关闭请求", status: "closed", needsReply: false }
      ].forEach(function (action) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = action.needsReply ? "primary-button" : "secondary-button";
        button.textContent = action.label;
        button.addEventListener("click", async function () {
          button.disabled = true;
          try {
            await request("/v1/admin/privacy-requests/" + encodeURIComponent(item.id), "POST", { status: action.status, response: reply.value });
            await loadQueue();
            status.textContent = "请求状态已更新。";
          } catch (error) { status.textContent = error.message; button.disabled = false; }
        });
        actions.appendChild(button);
      });
      card.appendChild(actions);
      queue.appendChild(card);
    });
  }

  document.getElementById("admin-login-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    token = document.getElementById("admin-api-token").value;
    status.textContent = "正在验证授权…";
    try {
      await loadQueue();
      document.getElementById("admin-api-token").value = "";
      document.getElementById("admin-logout").disabled = false;
      status.textContent = "已授权。令牌只保存在当前页面内存中。";
    } catch (error) {
      token = "";
      queue.replaceChildren();
      document.getElementById("admin-logout").disabled = true;
      status.textContent = error.message;
    }
  });

  document.getElementById("admin-logout").addEventListener("click", function () {
    token = "";
    queue.replaceChildren();
    document.getElementById("admin-api-token").value = "";
    document.getElementById("admin-logout").disabled = true;
    status.textContent = "本页令牌已清除。";
  });
})();
