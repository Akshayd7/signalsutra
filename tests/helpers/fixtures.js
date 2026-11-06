"use strict";
// FIXED synthetic candles (no network). Every series sits on the 1h grid starting
// 2026-01-01 00:00 UTC; the last candle is the live (forming) one, like the app.
const H = 3600000;
const T0 = Date.UTC(2026, 0, 1);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function candle(i, o, h, l, c, v) {
  const t = T0 + i * H;
  return { t, o, h, l, c, v: v == null ? 100 : v, ct: t + H - 1, q: (v == null ? 100 : v) * c, n: 50, tb: (v == null ? 100 : v) / 2 };
}

// Seeded random walk with periodic impulse candles: produces zones on both sides.
function walk(seed, n, start, drift) {
  const rnd = mulberry32(seed), out = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    const impulse = i % 17 === 9 ? (rnd() < 0.5 ? -1 : 1) * 0.03 : 0;
    const o = p, c = Math.max(0.01, o * (1 + drift + (rnd() - 0.5) * 0.008 + impulse));
    const h = Math.max(o, c) * (1 + rnd() * 0.003), l = Math.min(o, c) * (1 - rnd() * 0.003);
    out.push(candle(i, o, h, l, c, 50 + Math.round(rnd() * 200)));
    p = c;
  }
  return out;
}

// Quiet base, then a bearish candle (the order block) followed by a strong bullish candle.
// `after` decides what later CLOSED candles do to the zone [99.8, 101.2].
function bullScenario(after) {
  const out = [];
  let i = 0;
  for (; i < 70; i++) {
    const w = (i % 2 ? 0.15 : -0.15);
    out.push(candle(i, 100 + w, 100.3 + Math.abs(w), 99.9 - Math.abs(w) * 0.2, 100 - w, 100));
  }
  out.push(candle(i++, 101, 101.2, 99.8, 100, 120));      // bearish: the OB candle
  out.push(candle(i++, 100, 106.2, 99.9, 106, 400));      // strong bullish displacement
  for (let k = 0; k < 6; k++) out.push(candle(i++, 106, 106.4, 105.6, 106 + (k % 2 ? 0.2 : -0.2), 100));
  if (after === "wick") {
    out.push(candle(i++, 106, 106.1, 99.5, 100.6, 300)); // wick below the low edge, close back inside: zone kept (retested)
    out.push(candle(i++, 100.6, 101, 100.2, 100.8, 100));
  } else if (after === "close") {
    out.push(candle(i++, 106, 106.1, 99.0, 99.3, 300));  // CLOSE below the low edge (99.8): zone invalidated
    out.push(candle(i++, 99.3, 99.6, 99.1, 99.4, 100));
  } else {
    out.push(candle(i++, 106, 106.3, 105.7, 106.1, 100));
    out.push(candle(i++, 106.1, 106.4, 105.8, 106.2, 100));
  }
  out.push(candle(i++, out[out.length - 1].c, out[out.length - 1].c + 0.1, out[out.length - 1].c - 0.1, out[out.length - 1].c, 20)); // live candle
  return out;
}

// Price mirror around 200: a bullish structure becomes the matching bearish one.
function mirror(cs) {
  return cs.map(k => ({ ...k, o: 200 - k.o, c: 200 - k.c, h: 200 - k.l, l: 200 - k.h }));
}

const FIXTURES = {
  walkUp: walk(7, 200, 100, 0.0006),
  walkDown: walk(11, 200, 50, -0.0006),
  walkFlat: walk(23, 200, 2.5, 0),
  bullWick: bullScenario("wick"),
  bullClose: bullScenario("close"),
  bullUntouched: bullScenario("none"),
  bearWick: mirror(bullScenario("wick")),
  bearClose: mirror(bullScenario("close")),
};
const TICKER = { priceChangePercent: "1.25" };

module.exports = { H, T0, FIXTURES, TICKER, candle, mirror, bullScenario };
