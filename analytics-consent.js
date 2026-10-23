(function () {
  "use strict";

  var CONSENT_KEY = "bologna-students.umami-consent.v1";
  var WEBSITE_ID = "3c681631-af24-4ecd-98a8-5d1fa8cb861e";
  var SITE_HOST = "bologna-students.github.io";
  var TRACKER_URL = "https://cloud.umami.is/script.js";
  var EVENT_NAMES = {
    map: "guide_map_link",
    arcade: "halloween_arcade_entry",
    partner: "sponsor_link"
  };
  var volatileChoice = null;
  var trackerStarted = false;
  var pageviewSent = false;
  var ui = null;

  function readChoice() {
    try {
      var value = window.localStorage.getItem(CONSENT_KEY);
      if (value === "accepted" || value === "rejected") return value;
    } catch (error) {
      return volatileChoice;
    }
    return volatileChoice;
  }

  function saveChoice(value) {
    volatileChoice = value;
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function allowedPage() {
    return window.location.hostname === SITE_HOST;
  }

  function safePagePath() {
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    var allowedPaths = ["/", "/index.html", "/arcade.html", "/privacy.html"];
    return allowedPaths.indexOf(path) === -1 ? null : path;
  }

  function externalReferrerOrigin() {
    if (!document.referrer) return "";
    try {
      var referrer = new URL(document.referrer);
      if (referrer.hostname === window.location.hostname) return "";
      return referrer.origin;
    } catch (error) {
      return "";
    }
  }

  // The hook is evaluated for every send. It also makes revocation effective
  // in tabs where the tracker script was already loaded.
  window.bolognaUmamiBeforeSend = function (type, payload) {
    if (!allowedPage() || readChoice() !== "accepted") return false;
    if (type !== "event" && type !== "pageview") return false;
    var pagePath = safePagePath();
    if (!pagePath) return false;

    var name = payload && typeof payload.name === "string" ? payload.name : "";
    var allowedNames = [EVENT_NAMES.map, EVENT_NAMES.arcade, EVENT_NAMES.partner];
    if (type === "event" && allowedNames.indexOf(name) === -1) return false;
    if (type === "pageview" && name) return false;

    var safePayload = {
      website: WEBSITE_ID,
      hostname: SITE_HOST,
      url: pagePath,
      title: document.title,
      language: navigator.language || "",
      referrer: externalReferrerOrigin()
    };
    if (type === "event") safePayload.name = name;
    return safePayload;
  };

  function trackPageview() {
    if (pageviewSent || readChoice() !== "accepted" || !window.umami || typeof window.umami.track !== "function") return;
    var pagePath = safePagePath();
    if (!pagePath) return;
    pageviewSent = true;
    window.umami.track(function (props) {
      return Object.assign({}, props, {
        website: WEBSITE_ID,
        hostname: SITE_HOST,
        url: pagePath,
        title: document.title,
        language: navigator.language || "",
        referrer: externalReferrerOrigin()
      });
    });
  }

  function trackEvent(name) {
    if (!safePagePath() || readChoice() !== "accepted" || !window.umami || typeof window.umami.track !== "function") return;
    window.umami.track(name);
  }

  function startTracker() {
    if (trackerStarted || !allowedPage() || readChoice() !== "accepted") return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1") {
      if (ui && ui.status) ui.status.textContent = "浏览器的 Do Not Track 设置已阻止统计。";
      return;
    }

    trackerStarted = true;
    var script = document.createElement("script");
    script.async = true;
    script.src = TRACKER_URL;
    script.setAttribute("data-website-id", WEBSITE_ID);
    script.setAttribute("data-domains", SITE_HOST);
    script.setAttribute("data-auto-track", "false");
    script.setAttribute("data-exclude-search", "true");
    script.setAttribute("data-exclude-hash", "true");
    script.setAttribute("data-do-not-track", "true");
    script.setAttribute("data-before-send", "bolognaUmamiBeforeSend");
    script.onload = trackPageview;
    script.onerror = function () {
      trackerStarted = false;
      if (ui && ui.status) ui.status.textContent = "统计服务暂时无法连接；网站其他功能不受影响。";
    };
    document.head.appendChild(script);
  }

  function addAnalyticsClickListener() {
    document.addEventListener("click", function (event) {
      if (readChoice() !== "accepted" || !event.target || typeof event.target.closest !== "function") return;
      var anchor = event.target.closest("a[href]");
      if (!anchor) return;

      var href = anchor.href || "";
      var isPartnerLink = !!anchor.closest("[data-event-partner]");
      var isMapLink = /(^|\.)google\.[^/]+\/maps(?:\/|\?|$)/i.test(href.replace(/^https?:\/\//i, ""));

      if (isMapLink) trackEvent(EVENT_NAMES.map);
      if (anchor.dataset && anchor.dataset.bolognaAnalytics === "arcade-entry") trackEvent(EVENT_NAMES.arcade);
      if (isPartnerLink) trackEvent(EVENT_NAMES.partner);
    }, true);
  }

  function createUi() {
    if (ui || !document.body) return;

    var root = document.createElement("div");
    root.className = "umami-consent-root";
    root.innerHTML =
      '<section class="umami-consent-card" id="umami-consent-notice" aria-labelledby="umami-consent-title" hidden>' +
        '<div class="umami-consent-copy"><h2 id="umami-consent-title">匿名访问统计</h2>' +
          '<p>只有你允许后，才会加载 Umami 统计。拒绝不会影响网站使用；你之后可以随时撤回。</p></div>' +
        '<div class="umami-consent-actions">' +
          '<button type="button" data-umami-choice="accept">允许统计</button>' +
          '<button type="button" class="umami-secondary" data-umami-choice="reject">拒绝</button>' +
          '<a href="privacy.html#analytics">了解详情</a>' +
        '</div>' +
      '</section>' +
      '<button type="button" class="umami-preferences-trigger" id="umami-preferences-trigger" aria-haspopup="true" aria-expanded="false" hidden>统计偏好</button>' +
      '<section class="umami-consent-card umami-preferences-panel" id="umami-preferences-panel" aria-labelledby="umami-preferences-title" hidden>' +
        '<div class="umami-consent-copy"><h2 id="umami-preferences-title">统计偏好</h2>' +
          '<p id="umami-consent-state"></p><p class="umami-consent-status" id="umami-consent-status" role="status" aria-live="polite"></p></div>' +
        '<div class="umami-consent-actions">' +
          '<button type="button" data-umami-choice="accept">允许统计</button>' +
          '<button type="button" class="umami-secondary" data-umami-choice="reject">拒绝或撤回</button>' +
          '<button type="button" class="umami-text-button" data-umami-choice="close">关闭</button>' +
          '<a href="privacy.html#analytics">隐私说明</a>' +
        '</div>' +
      '</section>';

    document.body.appendChild(root);
    ui = {
      notice: root.querySelector("#umami-consent-notice"),
      trigger: root.querySelector("#umami-preferences-trigger"),
      panel: root.querySelector("#umami-preferences-panel"),
      state: root.querySelector("#umami-consent-state"),
      status: root.querySelector("#umami-consent-status")
    };

    root.addEventListener("click", function (event) {
      var button = event.target.closest("[data-umami-choice]");
      if (!button) return;
      var choice = button.getAttribute("data-umami-choice");

      if (choice === "accept") {
        var stored = saveChoice("accepted");
        renderUi();
        startTracker();
        if (!stored && ui.status) ui.status.textContent = "本浏览器无法保存偏好；本次页面有效，重新打开后会再次询问。";
      } else if (choice === "reject") {
        saveChoice("rejected");
        renderUi();
        if (ui.status) ui.status.textContent = "已拒绝或撤回；后续统计请求会被停止。";
      } else if (choice === "close") {
        ui.panel.hidden = true;
        ui.trigger.setAttribute("aria-expanded", "false");
        ui.trigger.focus();
      }
    });

    ui.trigger.addEventListener("click", function () {
      var opening = ui.panel.hidden;
      ui.panel.hidden = !opening;
      ui.trigger.setAttribute("aria-expanded", opening ? "true" : "false");
      if (opening) ui.panel.querySelector('[data-umami-choice="close"]').focus();
    });

    renderUi();
  }

  function renderUi() {
    if (!ui) return;
    var choice = readChoice();
    ui.notice.hidden = choice === "accepted" || choice === "rejected";
    ui.trigger.hidden = ui.notice.hidden ? false : true;
    if (ui.state) {
      ui.state.textContent = choice === "accepted"
        ? "当前选择：允许匿名统计。点击“拒绝或撤回”会停止后续统计。"
        : choice === "rejected"
          ? "当前选择：拒绝匿名统计。你可以随时更改。"
          : "尚未选择；统计脚本目前未加载。";
    }
  }

  function init() {
    createUi();
    addAnalyticsClickListener();
    startTracker();
  }

  window.addEventListener("storage", function (event) {
    if (event.key !== CONSENT_KEY) return;
    volatileChoice = event.newValue === "accepted" || event.newValue === "rejected" ? event.newValue : null;
    if (ui) renderUi();
    if (readChoice() === "accepted") startTracker();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
