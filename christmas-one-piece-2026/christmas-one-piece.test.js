const test = require("node:test");
const assert = require("node:assert/strict");
const { clamp, progressAt } = require("./christmas-one-piece.js");

test("clamps animation progress to the safe interval", () => {
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(clamp(.5, 0, 1), .5);
});

test("keeps the reveal hidden before its animation duration", () => {
  assert.equal(progressAt(1000, 3600, 5200), 0.5);
  assert.equal(progressAt(1000, 999, 5200), 0);
  assert.equal(progressAt(1000, 6200, 5200), 1);
});
