(function () {
  "use strict";
  var root = document.documentElement;
  var eventCards = Array.prototype.slice.call(document.querySelectorAll(".event-card[data-event-end]"));
  var checkedNote = document.querySelector(".event-date-checked");

  function romeDate() {
    try {
      var values = {};
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date()).forEach(function (part) { values[part.type] = part.value; });
      return values.year + "-" + values.month + "-" + values.day;
    } catch (_) {
      return null;
    }
  }

  function syncEvents() {
    var today = romeDate();
    if (!today) return;
    eventCards.forEach(function (card) {
      var ended = today > card.getAttribute("data-event-end");
      card.classList.toggle("is-past", ended);
      var label = card.querySelector(".event-past-label");
      if (ended && !label) {
        label = document.createElement("p");
        label.className = "event-past-label";
        label.setAttribute("role", "note");
        label.textContent = "已结束 · 往期活动信息";
        var heading = card.querySelector("h3");
        if (heading && heading.parentNode) heading.parentNode.insertBefore(label, heading.nextSibling);
      } else if (!ended && label) {
        label.parentNode.removeChild(label);
      }
    });
    if (checkedNote && root.dataset.halloweenPhase === "afterparty") {
      checkedNote.textContent = "部分十月线下活动已结束并标记为往期；出发前请查看主办方最新安排。信息核验日期：2026 年 10 月 21 日（Europe/Rome）。Bologna Students 仅整理公开信息，不负责第三方活动组织、票务或现场安排。";
    }
  }

  syncEvents();
  window.setInterval(syncEvents, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) syncEvents(); });
  window.addEventListener("pageshow", syncEvents);
  window.addEventListener("focus", syncEvents);
})();
