"use strict";
// Pulls named top-level functions / consts out of index.html's inline <script> so the pure
// engine and view-model code can be tested in plain Node (no browser, no dependencies).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const BASE_COMMIT = "eee588045da9c66e8d67149b718ebe517495bc22";

function readCurrent() {
  return fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
}

// Base commit source via git, or null when git / the commit is not available.
function readBase() {
  try {
    return execFileSync("git", ["show", BASE_COMMIT + ":index.html"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8 << 20 });
  } catch (e) {
    return null;
  }
}

function scriptOf(html) {
  const a = html.indexOf("<script>"), b = html.lastIndexOf("</script>");
  if (a < 0 || b < 0) throw new Error("inline script not found");
  return html.slice(a + 8, b);
}

// Source text of one top-level declaration: `function NAME(...){...}` or `const NAME=...;`
function grab(src, name) {
  const re = new RegExp("(^|[^\\w$.])(function " + name.replace(/\$/g, "\\$") + "\\(|const " + name.replace(/\$/g, "\\$") + "=)", "m");
  const m = re.exec(src);
  if (!m) throw new Error("declaration not found: " + name);
  const start = m.index + m[1].length;
  if (m[2].startsWith("function")) {
    const close = src.indexOf(")", start);
    let j = src.indexOf("{", close), d = 0, k = j;
    for (; k < src.length; k++) {
      const ch = src[k];
      if (ch === "{") d++;
      else if (ch === "}") { d--; if (!d) break; }
    }
    return src.slice(start, k + 1);
  }
  let d = 0, k = start;
  for (; k < src.length; k++) {
    const ch = src[k];
    if (ch === "{" || ch === "(" || ch === "[") d++;
    else if (ch === "}" || ch === ")" || ch === "]") d--;
    else if (ch === ";" && d === 0) break;
  }
  return src.slice(start, k + 1);
}

// Evaluate the named declarations together with an optional prelude (stubs for browser globals).
function load(html, names, prelude) {
  const src = scriptOf(html);
  const code = names.map(n => grab(src, n)).join("\n");
  const exportsList = names.filter(n => !/^[A-Z_]+$/.test(n) || true).join(",");
  // eslint-disable-next-line no-new-func
  return new Function((prelude || "") + "\n" + code + "\nreturn {" + exportsList + "};")();
}

function sources(html, names) {
  const src = scriptOf(html), out = {};
  for (const n of names) out[n] = grab(src, n);
  return out;
}

module.exports = { ROOT, BASE_COMMIT, readCurrent, readBase, scriptOf, grab, load, sources };
