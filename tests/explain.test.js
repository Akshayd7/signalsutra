"use strict";
// Read-only card model + plain-English explanation, on FIXED synthetic candles.
const test = require("node:test");
const assert = require("node:assert/strict");
const { readCurrent, load } = require("./helpers/extract");
const { ENGINE } = require("./helpers/engine");
const { H, FIXTURES, TICKER } = require("./helpers/fixtures");

const E = load(readCurrent(), ENGINE.concat(["TF_MS", "TF_WORDS", "CLOCK_SKEW_MS", "hhmm", "finOr", "cardModel", "plainLevel", "EXPLAIN_END", "explain"]));
const END = "Educational only - not a buy/sell signal.";
const HOST = "https://data-api.binance.vision";

function run(name) {
  const cs = FIXTURES[name].map(k => ({ ...k }));
  return E.analyse(name.toUpperCase(), TICKER, cs);
}
function freshCtx(r, over) {
  return Object.assign({ now: r.liveTime + 30 * 60e3, tf: "1h", fetchedAt: r.liveTime + 29 * 60e3, host: HOST, scanOk: true }, over || {});
}
const close = (a, b) => Math.abs(a - b) <= Math.abs(b) * 1e-12;
// numeric tokens as they appear in text: "75,912", "0.3610", "14:05", "10" from "+10%"
const tokens = s => String(s).match(/\d(?:[\d,.:]*\d)?/g) || [];

function allowedTokens(m) {
  const vals = [m.price];
  if (m.zone) vals.push(m.zone.low, m.zone.high, m.zone.mid);
  if (m.stop) vals.push(m.stop.price);
  for (const t of m.targets) vals.push(t.price);
  for (const l of m.levels.resistance.concat(m.levels.support)) vals.push(l.price);
  const strs = vals.filter(v => typeof v === "number").map(E.fmt);
  for (const t of m.targets) { strs.push(String(t.n)); if (t.pct) strs.push(t.pct); }
  if (m.zone && typeof m.zone.ageCandles === "number") strs.push(String(m.zone.ageCandles));
  strs.push(m.tf || "", E.TF_WORDS[m.tf] || "", E.hhmm(m.candleTime) || "", E.hhmm(m.fetchedAt) || "", m.source || "");
  return new Set(strs.flatMap(tokens));
}

test("targets are fixed +10% / +5% / +15% steps from the zone middle (long) and labelled fixed-percent", () => {
  const r = run("bullWick"), z = r.positionOB.bull[0];
  const m = E.cardModel(r, "bull", z, freshCtx(r));
  assert.equal(m.freshness, "fresh");
  const mid = (z.top + z.bot) / 2;
  assert.equal(m.zone.mid, mid);
  assert.equal(m.targets.length, 3);
  assert.ok(close(m.targets[0].price, mid * 1.10));
  assert.ok(close(m.targets[1].price, mid * 1.155));
  assert.ok(close(m.targets[2].price, mid * 1.32825));
  assert.deepEqual(m.targets.map(t => t.kind), ["fixed-percent", "fixed-percent", "fixed-percent"]);
  assert.deepEqual(m.targets.map(t => t.pct), ["+10%", "+15.5%", "+32.8%"]);
  const pc = E.planCore(r, "bull", z);
  assert.equal(m.stop.price, pc.slp, "stop copied from planCore");
  assert.deepEqual(m.targets.map(t => t.price), pc.tps.map(t => t.p), "targets copied from planCore");
  assert.equal(m.invalidation, "Void if a 1h candle closes below " + E.fmt(z.bot) + ".");
});

test("short targets mirror: -10% / -14.5% / -27.3% from the zone middle", () => {
  const r = run("bearWick"), z = r.positionOB.bear.find(o => o.inside);
  assert.ok(z, "bear fixture has an in-zone bearish order block");
  const m = E.cardModel(r, "bear", z, freshCtx(r));
  const mid = (z.top + z.bot) / 2;
  assert.ok(close(m.targets[0].price, mid * 0.90));
  assert.ok(close(m.targets[1].price, mid * 0.855));
  assert.ok(close(m.targets[2].price, mid * 0.72675));
  assert.deepEqual(m.targets.map(t => t.pct), ["-10%", "-14.5%", "-27.3%"]);
  assert.equal(m.direction, "short");
  assert.equal(m.invalidation, "Void if a 1h candle closes above " + E.fmt(z.top) + ".");
});

test("zone invalidated by a candle CLOSE beyond the far edge is removed; a wick-only touch keeps it (retested)", () => {
  const edge = o => o.bot === 99.8 && o.top === 101.2;
  assert.equal(run("bullClose").positionOB.bull.some(edge), false, "closed-through bullish zone dropped");
  const kept = run("bullWick").positionOB.bull.find(edge);
  assert.ok(kept, "wick-only bullish zone kept");
  assert.equal(kept.tapped, true);
  const r = run("bullWick");
  assert.equal(E.cardModel(r, "bull", kept, freshCtx(r)).zone.state, "retested");
  const r2 = run("bullUntouched");
  assert.equal(E.cardModel(r2, "bull", r2.positionOB.bull.find(edge), freshCtx(r2)).zone.state, "fresh");
  // mirrored shorts
  const medge = o => Math.abs(o.bot - 98.8) < 1e-9 && Math.abs(o.top - 100.2) < 1e-9;
  assert.equal(run("bearClose").positionOB.bear.some(medge), false, "closed-through bearish zone dropped");
  assert.ok(run("bearWick").positionOB.bear.some(medge), "wick-only bearish zone kept");
});

test("missing values read 'not available' and are never invented", () => {
  const r = run("bullClose"); // no valid bullish zone left
  const m = E.cardModel(r, "bull", null, freshCtx(r, { fetchedAt: null, host: null }));
  assert.equal(m.zone, null);
  assert.equal(m.stop, null);
  assert.deepEqual(m.targets, []);
  const txt = E.explain(m);
  assert.match(txt, /Zone \(long side\): not available/);
  assert.match(txt, /Stop reference: not available/);
  assert.match(txt, /Targets: not available/);
  assert.match(txt, /data fetched at not available from not available/);
  assert.match(txt, /What would cancel it: not available/);
  assert.ok(txt.endsWith(END));
  // no data at all
  const u = E.cardModel({ sym: "XYZ", price: undefined, liveTime: r.liveTime }, "bull", null, freshCtx(r));
  assert.equal(u.freshness, "unavailable");
  assert.match(E.explain(u), /not available/);
  assert.match(E.explain(null), /not available/);
  assert.ok(E.explain(null).endsWith(END));
  // unknown timeframe -> unavailable, not guessed
  assert.equal(E.cardModel(r, "bull", null, freshCtx(r, { tf: "4h" })).freshness, "unavailable");
});

test("stale, failed-scan and future timestamps show only a warning + last good time, no levels", () => {
  const r = run("bullWick"), z = r.positionOB.bull[0];
  const fresh = E.cardModel(r, "bull", z, freshCtx(r));
  const levelStrs = [fresh.zone.low, fresh.zone.high, fresh.zone.mid, fresh.stop.price, ...fresh.targets.map(t => t.price), ...fresh.levels.resistance.map(x => x.price), ...fresh.levels.support.map(x => x.price)].map(E.fmt);
  const cases = {
    "old-candle": freshCtx(r, { now: r.liveTime + 2 * H }),
    "future-timestamp": freshCtx(r, { now: r.liveTime - 2 * H, fetchedAt: r.liveTime - 2 * H }),
    "future-fetch": freshCtx(r, { fetchedAt: r.liveTime + 5 * H }),
    "scan-failed": freshCtx(r, { scanOk: false }),
  };
  for (const [name, ctx] of Object.entries(cases)) {
    const m = E.cardModel(r, "bull", z, ctx);
    assert.equal(m.freshness, "stale", name);
    assert.equal(m.zone, null, name);
    assert.equal(m.stop, null, name);
    assert.deepEqual(m.targets, [], name);
    assert.deepEqual(m.levels, { resistance: [], support: [] }, name);
    const txt = E.explain(m);
    assert.match(txt, /^Warning: /, name);
    assert.match(txt, /Levels are hidden until fresh data arrives\./, name);
    assert.ok(txt.includes("Last good data: candle " + E.hhmm(r.liveTime)), name);
    for (const s of levelStrs) assert.ok(!txt.includes(s), name + " leaks level " + s);
    assert.ok(txt.endsWith(END), name);
  }
  assert.equal(E.cardModel(r, "bull", z, cases["future-fetch"]).staleReason, "future-timestamp");
});

test("every number in explain() is fmt() of a model value, and every model level appears", () => {
  let checked = 0;
  for (const name of Object.keys(FIXTURES)) {
    const r = run(name);
    for (const side of ["bull", "bear"]) {
      const zones = [r[side].ob, ...r.positionOB[side]];
      for (const z of zones) {
        const m = E.cardModel(r, side, z, freshCtx(r));
        const txt = E.explain(m), ok = allowedTokens(m);
        for (const t of tokens(txt)) assert.ok(ok.has(t), `${name}/${side}: number "${t}" is not fmt() of a model value\n${txt}`);
        const must = [m.price];
        if (m.zone) must.push(m.zone.low, m.zone.high, m.zone.mid);
        if (m.stop) must.push(m.stop.price);
        m.targets.forEach(t => must.push(t.price));
        m.levels.resistance.concat(m.levels.support).forEach(l => must.push(l.price));
        for (const v of must) assert.ok(txt.includes(E.fmt(v)), `${name}/${side}: ${E.fmt(v)} missing`);
        assert.ok(txt.endsWith(END));
        assert.doesNotMatch(txt, /buy now|sell now|guarantee|profit|probabilit|certain/i);
        checked++;
      }
    }
  }
  assert.ok(checked >= 16, "covered " + checked + " card models");
});

test("cardModel is read-only: engine output is not mutated", () => {
  const r = run("walkFlat"), before = JSON.stringify(r);
  for (const side of ["bull", "bear"]) for (const z of [null, ...r.positionOB[side]]) E.explain(E.cardModel(r, side, z, freshCtx(r)));
  assert.equal(JSON.stringify(r), before);
});

test("model carries pair, timeframe, candle/fetch times, source host and past-price level labels", () => {
  const r = run("walkUp"), m = E.cardModel(r, "bull", r.bull.ob, freshCtx(r));
  assert.equal(m.pair, "WALKUP/USDT");
  assert.equal(m.tf, "1h");
  assert.equal(m.candleTime, r.liveTime);
  assert.equal(m.source, "data-api.binance.vision");
  for (const l of m.levels.resistance) { assert.equal(l.kind, "past price"); assert.equal(l.role, "resistance"); assert.ok(l.price > r.price); }
  for (const l of m.levels.support) { assert.equal(l.kind, "past price"); assert.equal(l.role, "support"); assert.ok(l.price < r.price); }
});
