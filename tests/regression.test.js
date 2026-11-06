"use strict";
// Before/after regression: the engine (analyse, findOB, zone states, scores, planCore/planLadder)
// and the protected calculation / alert / AI-request code must be identical to base commit eee5880.
const test = require("node:test");
const assert = require("node:assert/strict");
const { readCurrent, readBase } = require("./helpers/extract");
const { snapshot, hashes } = require("./helpers/engine");
const baseline = require("./fixtures/baseline-eee5880.json");

const html = readCurrent();

test("analyse + planCore outputs equal the base-commit snapshot on fixed fixtures", () => {
  const now = snapshot(html);
  assert.deepEqual(Object.keys(now).sort(), Object.keys(baseline.snapshot).sort());
  for (const k of Object.keys(baseline.snapshot)) assert.deepEqual(now[k], baseline.snapshot[k], "fixture " + k);
});

test("protected calculation/alert/AI-request source is byte-identical to the base commit", () => {
  const now = hashes(html);
  for (const [name, h] of Object.entries(baseline.hashes)) assert.equal(now[name], h, "source changed: " + name);
});

test("stored baseline matches a fresh recompute from the base commit (skipped without git history)", t => {
  const base = readBase();
  if (!base) { t.skip("git history for eee5880 not available"); return; }
  assert.deepEqual(snapshot(base), baseline.snapshot);
  assert.deepEqual(hashes(base), baseline.hashes);
});
