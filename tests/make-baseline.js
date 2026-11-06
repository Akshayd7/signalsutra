"use strict";
// Regenerates tests/fixtures/baseline-eee5880.json from the BASE commit's own functions
// (git show eee5880:index.html). Run: node tests/make-baseline.js
const fs = require("fs");
const path = require("path");
const { readBase, BASE_COMMIT } = require("./helpers/extract");
const { snapshot, hashes } = require("./helpers/engine");

const base = readBase();
if (!base) { console.error("git or base commit " + BASE_COMMIT + " not available"); process.exit(1); }
const out = { commit: BASE_COMMIT, note: "analyse/planCore outputs and protected-source hashes computed from the base commit on tests/helpers/fixtures.js", hashes: hashes(base), snapshot: snapshot(base) };
fs.mkdirSync(path.join(__dirname, "fixtures"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "fixtures", "baseline-eee5880.json"), JSON.stringify(out));
console.log("wrote baseline:", Object.keys(out.snapshot).length, "fixtures,", Object.keys(out.hashes).length, "protected functions");
