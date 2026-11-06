"use strict";
// AI quick-check request shape must be unchanged. fetch is MOCKED: the worker is never called.
const test = require("node:test");
const assert = require("node:assert/strict");
const { readCurrent, readBase, load } = require("./helpers/extract");
const { ENGINE } = require("./helpers/engine");
const { FIXTURES, TICKER } = require("./helpers/fixtures");

const WORKER = "https://signalsutra-ai-quick-check.pkt3f1.workers.dev";
const current = readCurrent();
const base = readBase();

// Minimal browser stand-ins shared by the extracted functions.
const PRELUDE = `
let results=[],open={},dataTF="1h",updatedAt=null,usedHost=null,scanFailed=false,aiQuickItems=[];
const __store={};
const $=id=>__store[id]||(__store[id]={id,textContent:"",innerHTML:"",hidden:true,firstChild:{textContent:""}});
const document={body:{classList:{contains:()=>false}},querySelectorAll:()=>[]};
const __ls={};const localStorage={getItem:k=>k in __ls?__ls[k]:null,setItem:(k,v)=>{__ls[k]=String(v)}};
let __calls=[];
async function fetch(url,init){__calls.push({url,init});return {ok:true,status:200,json:async()=>({item:{ticker:"MOCK-USD",generated_at:"2026-01-01T00:00:00Z",rating:"Hold"}})}}
function aiRenderQuick(){}
function aiQuickStatus(){}
function __setResults(x){results=x}
function __getCalls(){return __calls}
`;
const EXTRA = ["__store", "__setResults", "__getCalls"];
const VIEW = ["esc", "MTF", "mtfKey", "mtfText", "mtfPaint", "positionDistance", "positionCandidates", "positionRows", "posWhy", "planPct", "planLine", "tradePlan", "contiguous", "fmtVol", "cvdSeries", "cvdSpark", "volPanel", "renderPositions", "AI_WORKER_URL", "aiParseZoneRow", "aiRunQuick"];
const R1 = ["ICON", "TF_MS", "TF_WORDS", "CLOCK_SKEW_MS", "hhmm", "finOr", "cardModel", "plainLevel", "EXPLAIN_END", "explain", "explainHTML", "modelCtx", "explainBlock", "cardTime"];

function env(html, isBase) {
  const names = ENGINE.filter(n => n !== "positionDistance").concat(isBase ? [] : R1, VIEW);
  return load(html, names, PRELUDE, EXTRA);
}

// Tiny stand-in for the DOM queries aiParseZoneRow makes on a rendered Position Builder card.
function fakeRow(cardHTML) {
  const sym = (cardHTML.match(/<div class="position-top"><b>([^<]*)<\/b>/) || [])[1];
  const state = (cardHTML.match(/class="position-state[^"]*">([^<]*)</) || [])[1];
  const a = cardHTML.indexOf('<div class="meta">'), meta = cardHTML.slice(a, cardHTML.indexOf("</div>", a));
  const metaB = [...meta.matchAll(/<b>([^<]*)<\/b>/g)].map(x => x[1]);
  const node = t => ({ textContent: t });
  return {
    parsed: { sym, state, metaB },
    querySelector: sel => sel === ".position-top b" ? node(sym) : sel === ".position-state" ? node(state) : null,
    querySelectorAll: sel => sel === ".meta b" ? metaB.map(node) : [],
  };
}

function rendered(E) {
  const mk = (sym, name) => E.analyse(sym, TICKER, FIXTURES[name].map(k => ({ ...k })));
  E.__setResults([mk("AAA", "bullWick"), mk("BBB", "bearWick")]);
  E.renderPositions();
  const card = id => E.__store[id].innerHTML.split('<div class="position-row')[1];
  return { long: '<div class="position-row' + card("position-long"), short: '<div class="position-row' + card("position-short") };
}

async function request(E, cardHTML, side) {
  const row = fakeRow(cardHTML), btn = { disabled: false, textContent: "AI quick check" };
  await E.aiRunQuick(row, side, btn);
  const calls = E.__getCalls();
  return { row, call: calls[calls.length - 1] };
}

test("worker URL constant is unchanged", () => {
  assert.equal(env(current).AI_WORKER_URL, WORKER);
});

test("quick-check request from a rendered Position Builder card keeps its exact shape (mocked fetch)", async () => {
  const E = env(current), cards = rendered(E);
  for (const [side, html] of [["long", cards.long], ["short", cards.short]]) {
    const { row, call } = await request(E, html, side);
    assert.ok(call, "mock fetch received the request");
    assert.equal(call.url, WORKER + "/quick-check");
    assert.equal(call.init.method, "POST");
    assert.deepEqual(call.init.headers, { "content-type": "application/json" });
    const body = JSON.parse(call.init.body);
    assert.deepEqual(Object.keys(body), ["symbol", "event"]);
    assert.deepEqual(Object.keys(body.event), ["symbol", "side", "state", "zone_low", "zone_high", "price", "age_candles", "timeframe", "captured_at"]);
    assert.equal(body.symbol, row.parsed.sym);
    assert.equal(body.event.side, side);
    assert.ok(body.event.state === "fresh" || body.event.state === "retested");
    for (const k of ["zone_low", "zone_high", "price", "age_candles"]) assert.equal(typeof body.event[k], "number", k);
    assert.ok(body.event.zone_low < body.event.zone_high);
    assert.equal(body.event.timeframe, "1h");
    assert.match(body.event.captured_at, /^\d{4}-\d\d-\d\dT/);
  }
  assert.equal(E.__getCalls().length, 2, "only the mock was called");
});

test("request body matches the base commit's for the same cards (skipped without git history)", async t => {
  if (!base) { t.skip("git history for eee5880 not available"); return; }
  const Ec = env(current), Eb = env(base, true);
  const cc = rendered(Ec), cb = rendered(Eb);
  for (const side of ["long", "short"]) {
    // the card markup still yields the same values the AI request reads
    assert.deepEqual(fakeRow(cc[side]).parsed, fakeRow(cb[side]).parsed, side + " card parse");
    const a = JSON.parse((await request(Ec, cc[side], side)).call.init.body);
    const b = JSON.parse((await request(Eb, cb[side], side)).call.init.body);
    delete a.event.captured_at; delete b.event.captured_at;
    assert.deepEqual(a, b, side + " request body");
  }
});
