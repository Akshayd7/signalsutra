"use strict";
const crypto = require("crypto");
const { load, sources } = require("./extract");
const { FIXTURES, TICKER } = require("./fixtures");

// Pure engine functions needed to run analyse + planCore.
const ENGINE = ["clamp", "fmt", "atr", "swings", "equal", "findOB", "zoneProx", "analyse", "planLevels", "planZoneLevels", "dedupe", "roleLabel", "planLadder", "planCore", "positionDistance"];

// Calculation / data-validation / alert / AI-request code that Release 1 must not change.
// Their source text is hashed; the test asserts byte-identical source against the base commit.
const PROTECTED = ENGINE.concat([
  "HOSTS", "AI_WORKER_URL", "numOrNull", "parseKline", "contiguous", "volProfile", "planPct", "planLine", "tradePlan", "positionCandidates", "positionRows",
  "mtfLoad", "mtfText", "mtfRefresh", "api", "emitAlert", "checkPositionAlerts", "checkAlerts",
  "dlCloseClean", "dlFresh", "dlWindow", "dlAtr", "dlTol", "dlPivots", "dlCluster", "dlPick", "dlLevels", "dlNote", "dlEnsure",
  "lvMsg", "lvPace", "lvAvg20", "lvSpike", "aiParseZoneRow", "aiRunQuick", "aiStale", "aiFuture",
]);

function engineOf(html) {
  return load(html, ENGINE);
}

// Deterministic snapshot of analyse + planCore for every fixture (board zone and every listed zone).
function snapshot(html) {
  const E = engineOf(html), out = {};
  for (const [name, cs] of Object.entries(FIXTURES)) {
    const r = E.analyse(name.toUpperCase(), TICKER, cs.map(k => ({ ...k })));
    const plans = {};
    for (const side of ["bull", "bear"]) {
      plans[side] = {
        board: E.planCore(r, side, r[side].ob),
        auto: E.planCore(r, side, null),
        zones: r.positionOB[side].map(z => E.planCore(r, side, z)),
      };
    }
    out[name] = JSON.parse(JSON.stringify({ r, plans }));
  }
  return out;
}

function hashes(html) {
  const s = sources(html, PROTECTED), out = {};
  for (const [k, v] of Object.entries(s)) out[k] = crypto.createHash("sha256").update(v).digest("hex");
  return out;
}

module.exports = { ENGINE, PROTECTED, engineOf, snapshot, hashes };
