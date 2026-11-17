(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BolognaDeadlineStatus = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  const ROME_TIME_ZONE = "Europe/Rome";
  const ROME_PARTS = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  function romeDateTime(now) {
    const parts = Object.fromEntries(
      ROME_PARTS.formatToParts(now).map(({ type, value }) => [type, value])
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function getDeadlineStatus(deadline, now) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline)) {
      throw new Error(`Invalid Rome deadline: ${deadline}`);
    }
    return romeDateTime(now) >= deadline ? "expired" : "upcoming";
  }

  function updateDeadlineElements(rootElement, now = new Date()) {
    rootElement.querySelectorAll("[data-deadline]").forEach((element) => {
      const expired = getDeadlineStatus(element.dataset.deadline, now) === "expired";
      element.classList.toggle("is-expired", expired);
      element.classList.toggle("urgent", !expired && element.dataset.urgent === "true");
      element.querySelectorAll("[data-deadline-status]").forEach((status) => {
        status.textContent = expired ? "已截止" : "申请截止";
      });
    });
  }

  return { getDeadlineStatus, romeDateTime, updateDeadlineElements };
});

