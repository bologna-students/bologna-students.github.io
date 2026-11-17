const test = require("node:test");
const assert = require("node:assert/strict");
const { getDeadlineStatus, romeDateTime } = require("./deadline-status.js");

const deadline = "2026-11-03T16:00";

test("is upcoming immediately before the Rome deadline", () => {
  assert.equal(getDeadlineStatus(deadline, new Date("2026-11-03T14:59:59Z")), "upcoming");
});

test("expires at the exact Rome deadline", () => {
  assert.equal(getDeadlineStatus(deadline, new Date("2026-11-03T15:00:00Z")), "expired");
});

test("handles the Rome date after the deadline", () => {
  assert.equal(getDeadlineStatus(deadline, new Date("2026-11-04T00:00:00Z")), "expired");
});

test("uses Europe/Rome rather than the browser timezone", () => {
  assert.equal(romeDateTime(new Date("2026-11-03T15:00:00Z")), deadline);
  assert.equal(getDeadlineStatus("2026-11-03T16:00", new Date("2026-11-03T14:00:00Z")), "upcoming");
});

