(() => {
"use strict";
const CFG = Object.assign({NAME:"MERGED",TICKER:"MERGED",CA:"",CHAIN:"solana",PAD:"pumpfun",X:"",BUY:"",CHART:"",AGENT_GH:""}, window.MERGED_CFG || {});
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
let RM = mq.matches;
try { mq.addEventListener("change", e => { RM = e.matches; }); } catch (e) {}

function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = s / 60; if (m < 60) return Math.round(m) + "m ago";
  const hh = m / 60; if (hh < 24) return Math.round(hh) + "h ago";
  const d = hh / 24; if (d < 31) return Math.round(d) + "d ago";
  const mo = d / 30.4; if (mo < 12) return Math.round(mo) + "mo ago";
  return Math.round(mo / 12) + "y ago";
}

/* ---------- tiny session cache ---------- */
const store = {
  get(k) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- GitHub (unauthenticated, cached, backs off) ---------- */
const API = "https://api.github.com";
function ghErr(kind, extra) { const e = new Error(kind); e.kind = kind; return Object.assign(e, extra || {}); }
function backoffUntil() { const b = store.get("mg:backoff"); return b && b > Date.now() ? b : 0; }
async function gh(path, ttl) {
  const key = "mg:" + path;
  const c = store.get(key);
  if (c && Date.now() - c.t < ttl) return { d: c.d, t: c.t };
  const bo = backoffUntil();
  if (bo) throw ghErr("rate", { until: bo });
  let r;
  try { r = await fetch(API + path, { headers: { Accept: "application/vnd.github+json" } }); }
  catch (e) { throw ghErr("network"); }
  if (r.status === 403 || r.status === 429) {
    const ra = parseInt(r.headers.get("retry-after") || "", 10);
    const reset = parseInt(r.headers.get("x-ratelimit-reset") || "", 10);
    let until = ra ? Date.now() + ra * 1000 : reset ? reset * 1000 + 1000 : Date.now() + 60000;
    until = Math.min(Math.max(until, Date.now() + 15000), Date.now() + 5 * 60000);
    store.set("mg:backoff", until);
    throw ghErr("rate", { until });
  }
  if (!r.ok) throw ghErr("http", { status: r.status });
  const d = await r.json();
  const t = Date.now();
  store.set(key, { t, d });
  return { d, t };
}
function stale(path) { const c = store.get("mg:" + path); return c ? { d: c.d, t: c.t } : null; }
const searchPath = (q, n) => "/search/issues?q=" + encodeURIComponent(q) + "&sort=updated&order=desc&per_page=" + (n || 20);

/* Popular repos (all 1,000+ stars) and their main language, for the queue + demo patch style */
const REPOS = {
  "facebook/react":"ts","vercel/next.js":"ts","microsoft/vscode":"ts","vitejs/vite":"ts","sveltejs/svelte":"ts","vuejs/core":"ts",
  "withastro/astro":"ts","nuxt/nuxt":"ts","prettier/prettier":"ts","eslint/eslint":"ts","mui/material-ui":"ts","storybookjs/storybook":"ts",
  "excalidraw/excalidraw":"ts","n8n-io/n8n":"ts","calcom/cal.com":"ts","twentyhq/twenty":"ts","vitest-dev/vitest":"ts","microsoft/playwright":"ts",
  "supabase/supabase":"ts","jestjs/jest":"ts","nodejs/node":"ts",
  "pandas-dev/pandas":"py","numpy/numpy":"py","scikit-learn/scikit-learn":"py","huggingface/transformers":"py","pydantic/pydantic":"py",
  "streamlit/streamlit":"py","gradio-app/gradio":"py","apache/airflow":"py","mlflow/mlflow":"py","python/mypy":"py","pytest-dev/pytest":"py",
  "home-assistant/core":"py","langchain-ai/langchain":"py",
  "kubernetes/kubernetes":"go","prometheus/prometheus":"go","gohugoio/hugo":"go","hashicorp/terraform":"go","grafana/grafana":"go",
  "traefik/traefik":"go","go-gitea/gitea":"go","ollama/ollama":"go",
  "rust-lang/rust":"rs","astral-sh/ruff":"rs","astral-sh/uv":"rs","tauri-apps/tauri":"rs","zed-industries/zed":"rs","nushell/nushell":"rs",
  "bevyengine/bevy":"rs","helix-editor/helix":"rs","biomejs/biome":"rs","denoland/deno":"rs","pola-rs/polars":"rs",
  "neovim/neovim":"c","godotengine/godot":"c"
};
const Q_CURATED = 'is:issue is:open label:"good first issue" ' + Object.keys(REPOS).map(r => "repo:" + r).join(" ");
const Q_ALL = 'is:issue is:open label:"good first issue"';

/* ---------- static bits from config ---------- */
$$("[data-ticker]").forEach(e => e.textContent = CFG.TICKER);
$$("[data-name]").forEach(e => e.textContent = CFG.NAME);
(function token() {
  const CA = (CFG.CA || "").trim();
  const buy = CFG.BUY || (CA ? "https://pump.fun/coin/" + CA : "");
  const chart = CFG.CHART || (CA ? "https://gmgn.ai/sol/token/" + CA : "");
  const set = (el, url) => {
    if (!el) return;
    if (url) { el.href = url; el.target = "_blank"; el.rel = "noopener"; el.removeAttribute("aria-disabled"); el.removeAttribute("tabindex"); }
    else { el.removeAttribute("href"); el.setAttribute("aria-disabled", "true"); el.setAttribute("tabindex", "-1"); el.title = "At launch"; }
  };
  set($("#tBuy"), buy); set($("#tChart"), chart); set($("#tX"), CFG.X);
  const nb = $("[data-buy]");
  if (buy) { nb.href = buy; nb.target = "_blank"; nb.rel = "noopener"; }
  else { nb.textContent = "CA soon"; nb.classList.remove("btn-p"); nb.classList.add("btn-g"); }
  // hero token chip: real CA when set, otherwise "CA soon" and a jump to the token strip
  const hc = $("#heroCA");
  if (hc && CA) {
    hc.classList.add("set");
    $("#heroCAv").textContent = CA.slice(0, 4) + "…" + CA.slice(-4);
    $("#heroCAc").textContent = "Copy CA";
    hc.addEventListener("click", async ev => {
      ev.preventDefault();
      let ok = false;
      try { await navigator.clipboard.writeText(CA); ok = true; } catch (e) {}
      $("#heroCAc").textContent = ok ? "Copied" : "See below";
      if (!ok) $("#token").scrollIntoView({ behavior: RM ? "auto" : "smooth" });
      setTimeout(() => $("#heroCAc").textContent = "Copy CA", 1600);
    });
  }
  const code = $("#caText"), copy = $("#caCopy");
  if (CA) {
    code.textContent = CA; code.classList.remove("soon"); copy.removeAttribute("aria-disabled");
    copy.addEventListener("click", async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(CA); ok = true; } catch (e) {
        try { const t = document.createElement("textarea"); t.value = CA; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); ok = document.execCommand("copy"); t.remove(); } catch (e2) {}
      }
      copy.textContent = ok ? "Copied" : "Copy failed";
      setTimeout(() => copy.textContent = "Copy", 1600);
    });
  } else { copy.setAttribute("tabindex", "-1"); }
})();

/* ================= LIVE QUEUE ================= */
const Q = { items: [], mode: "", t: 0, cached: false, seen: new Set(), first: true, expanded: false, loading: false, err: null };
const qBody = $("#qBody"), qCard = $("#queue");
const SHOW = 6;

const keyLbl = l => /good first|help wanted|(^|\W)bug(\W|$)/i.test(l) ? 1 : 0;
function mapIssue(it) {
  const repo = (it.repository_url || "").replace(API + "/repos/", "");
  return { id: it.id, repo, number: it.number, title: (it.title || "").trim(), url: it.html_url, labels: (it.labels || []).map(l => typeof l === "string" ? l : l.name).filter(Boolean).sort((a, b) => keyLbl(b) - keyLbl(a)), created: it.created_at, updated: it.updated_at };
}

async function loadQueue(manual) {
  if (Q.loading) return;
  Q.loading = true; qCard.classList.add("fetching");
  const ttl = manual ? 10000 : 60000;
  let res = null, mode = "curated", err = null;
  try {
    try {
      res = await gh(searchPath(Q_CURATED, 20), ttl);
      if (!res.d.items || !res.d.items.length) throw ghErr("empty");
    } catch (e) {
      if (e.kind === "http" || e.kind === "empty") { mode = "all"; res = await gh(searchPath(Q_ALL, 20), ttl); }
      else throw e;
    }
  } catch (e) { err = e; }
  let cached = false;
  if (err) {
    const s = stale(searchPath(Q_CURATED, 20)) || stale(searchPath(Q_ALL, 20));
    if (s && s.d.items && s.d.items.length) { res = s; cached = true; mode = stale(searchPath(Q_CURATED, 20)) ? "curated" : "all"; }
  }
  Q.loading = false; qCard.classList.remove("fetching");
  if (res && res.d && res.d.items && res.d.items.length) {
    Q.err = cached ? err : null; Q.cached = cached; Q.mode = mode; Q.t = res.t;
    Q.items = res.d.items.filter(i => !i.pull_request).map(mapIssue).filter(i => i.repo && i.title);
    renderQueue();
    onQueueReady();
  } else {
    Q.err = err || ghErr("empty");
    renderQueueError();
    onQueueReady();
  }
  updStamp();
}

function renderQueue() {
  const fresh = [];
  qBody.innerHTML = "";
  const ul = h("ul", "qlist"); ul.id = "qList";
  Q.items.forEach((it, i) => {
    const li = h("li");
    if (!Q.first && !Q.seen.has(it.id)) { li.className = "is-new"; fresh.push(it.id); }
    else if (Q.first && !RM) { li.className = "in"; li.style.animationDelay = (i * 60) + "ms"; }
    if (i >= SHOW && !Q.expanded) li.hidden = true;
    const a = h("a", "qrow"); a.href = it.url; a.target = "_blank"; a.rel = "noopener";
    const r = h("div", "qrepo"); r.append(h("span", "", it.repo), h("span", "num", "#" + it.number));
    const t = h("div", "qtitle", it.title);
    const m = h("div", "qmeta");
    it.labels.slice(0, 3).forEach(l => m.append(h("span", "lbl" + (/good first|help wanted|^bug$|type: ?bug/i.test(l) ? " k" : ""), l)));
    const age = h("span", "age", "active " + ago(it.updated)); age.dataset.t = it.updated; age.title = "opened " + ago(it.created); m.append(age);
    a.append(r, t, m); li.append(a); ul.append(li);
  });
  qBody.append(ul);
  Q.items.forEach(i => Q.seen.add(i.id));
  const nw = $("#qNew");
  if (fresh.length) { nw.textContent = "+" + fresh.length + " new"; nw.hidden = false; setTimeout(() => nw.hidden = true, 6000); }
  Q.first = false;
  $("#qSrc").textContent = Q.mode === "curated"
    ? "good first issue · " + Object.keys(REPOS).length + " repos with 1k+ stars"
    : "good first issue · all public repos · sorted by updated";
  const more = $("#qMore");
  const extra = Q.items.length - SHOW;
  if (extra > 0) { more.hidden = false; more.textContent = Q.expanded ? "Show less" : "Show " + extra + " more"; } else more.hidden = true;
  $("#qTag").hidden = false;
  $("#qRefresh").disabled = false;
}

function renderQueueError() {
  qBody.innerHTML = "";
  const box = h("div", "qempty");
  const rate = Q.err && Q.err.kind === "rate";
  box.append(h("h4", "", rate ? "GitHub asked us to slow down." : "GitHub isn't answering right now."));
  box.append(h("p", "", rate
    ? "Unauthenticated search allows 10 requests a minute. The queue comes back on its own."
    : "No issues to show. Nothing here is faked, so this stays empty until the request works."));
  const b = h("button", "btn btn-g", "Retry"); b.type = "button"; b.id = "qRetry";
  b.addEventListener("click", () => loadQueue(true));
  box.append(b);
  qBody.append(box);
  $("#qMore").hidden = true;
  $("#qTag").hidden = true;
  $("#qSrc").textContent = "label: good first issue · sorted by updated";
}

function updStamp() {
  const el = $("#qUpdated"), rb = $("#qRefresh"), retry = $("#qRetry");
  const bo = backoffUntil();
  if (Q.items.length) {
    el.textContent = (Q.cached ? "cached · " : "updated ") + ago(new Date(Q.t).toISOString());
  } else if (Q.err) el.textContent = "offline";
  const wait = bo ? Math.ceil((bo - Date.now()) / 1000) : 0;
  [rb, retry].forEach(b => { if (!b) return; b.disabled = wait > 0; });
  if (retry) retry.textContent = wait > 0 ? "Retry in " + wait + "s" : "Retry";
  if (wait > 0 && Q.items.length) el.textContent += " · next in " + wait + "s";
  $$(".qlist .age").forEach(a => a.textContent = "active " + ago(a.dataset.t));
}
setInterval(updStamp, 1000);
$("#qRefresh").addEventListener("click", () => loadQueue(true));
$("#qMore").addEventListener("click", () => {
  Q.expanded = !Q.expanded;
  $$("#qList li").forEach((li, i) => { if (i >= SHOW) li.hidden = !Q.expanded; });
  $("#qMore").textContent = Q.expanded ? "Show less" : "Show " + (Q.items.length - SHOW) + " more";
});
setInterval(() => {
  if (document.visibilityState === "visible" && !backoffUntil()) loadQueue(false);
}, 75000);

/* ================= DEMO RUN ================= */
const SAMPLE = { sample: true, repo: "example-org/sample-repo", number: 1042, title: "Crash when the config file has an empty include list", url: "", labels: ["bug", "good first issue"], created: new Date(Date.now() - 3 * 864e5).toISOString() };
const R = { issue: null, lang: "ts", pick: -1, idx: -1, prog: 0, done: new Set(), token: 0, started: false };
const stepEls = $$(".step[data-k]");

function langOf(repo) { return REPOS[repo] || null; }
const LANGMAP = { TypeScript:"ts", JavaScript:"ts", Vue:"ts", Svelte:"ts", Astro:"ts", MDX:"ts", Python:"py", "Jupyter Notebook":"py", Go:"go", Rust:"rs", C:"c", "C++":"c", Zig:"c", "Objective-C":"c" };
async function resolveLang(repo) {
  const k = langOf(repo); if (k) return k;
  try {
    const p = gh("/repos/" + repo, 864e5);
    const res = await Promise.race([p, sleep(2500).then(() => null)]);
    if (res && res.d && res.d.language) return LANGMAP[res.d.language] || "c";
  } catch (e) {}
  return "ts";
}

function pickIssue() {
  const pool = Q.items.filter(i => i.title.length >= 14 && i.title.length <= 120);
  const list = pool.length ? pool : Q.items;
  if (!list.length) return SAMPLE;
  R.pick = (R.pick + 1) % list.length;
  return list[R.pick];
}

function slug(repo) { return (repo.split("/")[1] || "repo").toLowerCase(); }
function pkg(repo) { return slug(repo).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "pkg"; }

function pack(lang, iss) {
  const n = iss.number, name = slug(iss.repo), P = pkg(iss.repo), clone = "$ git clone --depth 1 https://github.com/" + iss.repo + ".git";
  const L = {
    ts: {
      term: [
        ["c", clone], ["c", "$ cd " + name + " && pnpm install --frozen-lockfile"], ["o", "  packages installed in 14.2s", "c-m"],
        ["c", "$ pnpm vitest run test/issue-" + n + ".test.ts"],
        ["o", " FAIL  test/issue-" + n + ".test.ts > reproduces #" + n, "c-r"],
        ["o", "TypeError: Cannot read properties of undefined (reading 'length')", "c-r"],
        ["o", "    at resolveOptions (src/utils/resolve-options.ts:41:22)", "c-m"],
        ["o", " Tests  1 failed (1)", "c-r"], ["o", "→ reproduced on main @ 9c4e1f2", "c-p"]],
      diff: [
        ["f", "--- a/src/utils/resolve-options.ts"], ["f", "+++ b/src/utils/resolve-options.ts"],
        ["h", "@@ -38,9 +38,8 @@ export function resolveOptions(input?: UserOptions) {"],
        [" ", "  const opts = { ...DEFAULTS, ...input };"],
        ["-", "  const entries = opts.include.length"], ["-", "    ? opts.include"], ["-", "    : DEFAULTS.include;"],
        ["+", "  const include = opts.include ?? [];"], ["+", "  const entries = include.length ? include : DEFAULTS.include;"],
        [" ", "  return { ...opts, include: entries };"],
        ["f", "--- a/test/resolve-options.test.ts"], ["f", "+++ b/test/resolve-options.test.ts"],
        ["h", "@@ -88,3 +88,8 @@ describe(\"resolveOptions\", () => {"],
        ["+", "  it(\"handles a missing include list (#" + n + ")\", () => {"],
        ["+", "    expect(resolveOptions({ include: undefined }).include)"],
        ["+", "      .toEqual(DEFAULTS.include);"], ["+", "  });"], [" ", "});"]],
      files: "src/utils/resolve-options.ts, test/resolve-options.test.ts", runner: "pnpm test", total: 412
    },
    py: {
      term: [
        ["c", clone], ["c", "$ cd " + name + " && python -m pip install -e \".[test]\" -q"],
        ["c", "$ python -m pytest tests/test_issue_" + n + ".py -q"],
        ["o", "F                                                    [100%]", "c-r"],
        ["o", "E   AttributeError: 'NoneType' object has no attribute 'strip'", "c-r"],
        ["o", P + "/_utils.py:57: in normalize_name", "c-m"],
        ["o", "1 failed in 0.41s", "c-r"], ["o", "→ reproduced on main @ 9c4e1f2", "c-p"]],
      diff: [
        ["f", "--- a/" + P + "/_utils.py"], ["f", "+++ b/" + P + "/_utils.py"],
        ["h", "@@ -54,5 +54,7 @@ def normalize_name(value):"],
        [" ", "    \"\"\"Return a clean, comparable name.\"\"\""],
        ["+", "    if value is None:"], ["+", "        return \"\""],
        [" ", "    return value.strip().lower()"],
        ["f", "--- a/tests/test_utils.py"], ["f", "+++ b/tests/test_utils.py"],
        ["h", "@@ -120,3 +120,7 @@ def test_normalize_name_basic():"],
        ["+", ""], ["+", "def test_normalize_name_none():  # #" + n], ["+", "    assert normalize_name(None) == \"\""]],
      files: P + "/_utils.py, tests/test_utils.py", runner: "pytest", total: 1286
    },
    go: {
      term: [
        ["c", clone], ["c", "$ cd " + name + " && go test ./internal/config/ -run TestIssue" + n],
        ["o", "--- FAIL: TestIssue" + n + " (0.00s)", "c-r"],
        ["o", "panic: runtime error: invalid memory address or nil pointer dereference", "c-r"],
        ["o", "	internal/config/merge.go:31 +0x1c", "c-m"],
        ["o", "FAIL	github.com/" + iss.repo + "/internal/config	0.012s", "c-r"], ["o", "→ reproduced on main @ 9c4e1f2", "c-p"]],
      diff: [
        ["f", "--- a/internal/config/merge.go"], ["f", "+++ b/internal/config/merge.go"],
        ["h", "@@ -28,6 +28,9 @@ func Merge(base, over *Config) *Config {"],
        ["+", "	if over == nil {"], ["+", "		return base"], ["+", "	}"],
        [" ", "	out := *base"], [" ", "	out.Name = over.Name"],
        ["f", "--- a/internal/config/merge_test.go"], ["f", "+++ b/internal/config/merge_test.go"],
        ["h", "@@ -64,3 +64,9 @@ func TestMergeEmpty(t *testing.T) {"],
        ["+", ""], ["+", "func TestMergeNilOverride(t *testing.T) { // #" + n],
        ["+", "	if got := Merge(&Config{Name: \"a\"}, nil); got.Name != \"a\" {"],
        ["+", "		t.Fatalf(\"got %q\", got.Name)"], ["+", "	}"], ["+", "}"]],
      files: "internal/config/merge.go, internal/config/merge_test.go", runner: "go test ./...", total: 734
    },
    rs: {
      term: [
        ["c", clone], ["c", "$ cd " + name + " && cargo test issue_" + n],
        ["o", "thread 'tests::issue_" + n + "' panicked at src/parse.rs:88:41:", "c-r"],
        ["o", "called `Option::unwrap()` on a `None` value", "c-r"],
        ["o", "test result: FAILED. 0 passed; 1 failed", "c-r"], ["o", "→ reproduced on main @ 9c4e1f2", "c-p"]],
      diff: [
        ["f", "--- a/src/parse.rs"], ["f", "+++ b/src/parse.rs"],
        ["h", "@@ -85,7 +85,9 @@ pub fn parse_header(input: &str) -> Result<Header, Error> {"],
        ["-", "    let (key, value) = input.split_once(':').unwrap();"],
        ["+", "    let Some((key, value)) = input.split_once(':') else {"],
        ["+", "        return Err(Error::MissingSeparator);"], ["+", "    };"],
        [" ", "    Ok(Header::new(key.trim(), value.trim()))"],
        ["f", "--- a/src/tests.rs"], ["f", "+++ b/src/tests.rs"],
        ["h", "@@ -40,3 +40,8 @@ mod tests {"],
        ["+", "    #[test]"], ["+", "    fn header_without_colon_is_error() { // #" + n],
        ["+", "        assert!(parse_header(\"no-colon\").is_err());"], ["+", "    }"]],
      files: "src/parse.rs, src/tests.rs", runner: "cargo test", total: 958
    },
    c: {
      term: [
        ["c", clone], ["c", "$ cd " + name + " && make test TEST=issue_" + n],
        ["o", "FAIL issue_" + n + ": expected 0, got -1", "c-r"],
        ["o", "  at test/test_buffer.c:58", "c-m"],
        ["o", "1 of 1 tests failed", "c-r"], ["o", "→ reproduced on main @ 9c4e1f2", "c-p"]],
      diff: [
        ["f", "--- a/src/buffer.c"], ["f", "+++ b/src/buffer.c"],
        ["h", "@@ -112,6 +112,8 @@ int buf_append(buf_t *b, const char *s, size_t n)"],
        [" ", "{"], ["+", "    if (n == 0)"], ["+", "        return 0;"],
        [" ", "    if (buf_grow(b, b->len + n) < 0)"], [" ", "        return -1;"],
        ["f", "--- a/test/test_buffer.c"], ["f", "+++ b/test/test_buffer.c"],
        ["h", "@@ -51,3 +51,8 @@"],
        ["+", "/* #" + n + " */"], ["+", "static void test_append_empty(void) {"],
        ["+", "    buf_t b = BUF_INIT;"], ["+", "    assert(buf_append(&b, \"\", 0) == 0);"], ["+", "}"]],
      files: "src/buffer.c, test/test_buffer.c", runner: "make test", total: 522
    }
  };
  return L[lang] || L.ts;
}

function codeBlock(lines, diff) {
  const box = h("div", "code" + (diff ? " diff" : ""));
  lines.forEach(([k, text, cls]) => {
    const ln = h("span", "ln");
    if (diff) {
      ln.classList.add({ "+": "add", "-": "del", " ": "ctx", f: "fh", h: "hunk" }[k]);
      const gt = h("span", "gt", k === "+" || k === "-" ? k : ""); ln.append(gt);
    } else ln.dataset.k = k;
    const tx = h("span", "tx " + (cls || (k === "c" ? "c-w" : "")), text || " ");
    ln.append(tx); box.append(ln);
  });
  return box;
}

function aiIcon() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 32 32"); s.style.color = "var(--purple)";
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#glyph");
  s.append(u); return s;
}

function renderRun() {
  const iss = R.issue, p = pack(R.lang, iss), n = iss.number;
  R.p = p;
  $("#forkCmd").textContent = "git switch -c merged/fix-" + n;
  $("#runSrcTag").textContent = iss.pending ? "loading an issue from the live queue…" : iss.sample ? "SAMPLE issue · live queue unavailable" : "issue: live from GitHub";
  $("#stampSub").textContent = "into main · closes #" + n;

  // 01 read
  const a1 = $("#artRead"); a1.innerHTML = "";
  const pan = h("div", "panel");
  const card = h("div", "issue");
  const ir = h("div", "ir rv"); ir.append(h("span", "", iss.repo), h("span", "", "#" + n), h("span", "", "opened " + ago(iss.created)), h("span", "", "active " + ago(iss.updated || iss.created)));
  const it = h("div", "it rv", iss.title);
  const il = h("div", "il rv"); iss.labels.slice(0, 4).forEach(l => il.append(h("span", "lbl" + (/good first|help wanted|bug/i.test(l) ? " k" : ""), l)));
  card.append(ir, it, il);
  if (iss.url) { const lk = h("a", "ilink rv", "Open the real issue ↗"); lk.href = iss.url; lk.target = "_blank"; lk.rel = "noopener"; card.append(lk); }
  else card.append(h("div", "ilink rv", "Sample issue, shown because the live queue is unavailable"));
  const checks = h("div", "checks");
  checks.append(codeBlock([
    ["c", "→ read CONTRIBUTING.md + AI policy", "c-w"], ["o", "  no rule against AI PRs (simulated)", "c-m"],
    ["c", "→ open PRs from MERGED on this repo: 0 / 1", "c-w"],
    ["c", "→ PRs today: 3 / 10", "c-w"], ["o", "  ok, taking it", "c-p"]]));
  pan.append(card, checks); a1.append(pan);

  // 02 reproduce
  const a2 = $("#artRepro"); a2.innerHTML = "";
  const t2 = h("div", "panel"); const hd2 = h("div", "phead"); hd2.append(h("span", "", "sandbox · " + slug(iss.repo)), h("span", "r", "simulated output"));
  t2.append(hd2, codeBlock(p.term)); a2.append(t2);

  // 03 patch
  const a3 = $("#artPatch"); a3.innerHTML = "";
  const adds = p.diff.filter(d => d[0] === "+").length, dels = p.diff.filter(d => d[0] === "-").length;
  const t3 = h("div", "panel"); const hd3 = h("div", "phead"); hd3.append(h("span", "", "merged/fix-" + n));
  const ds = h("span", "r diffstat"); const ga = h("span", "c-g", "+" + adds); const gd = h("span", "c-r", " −" + dels); ds.append(ga, gd, h("span", "", " · 2 files"));
  hd3.append(ds); t3.append(hd3, codeBlock(p.diff, true)); a3.append(t3);

  // 04 tests
  const a4 = $("#artTests"); a4.innerHTML = "";
  const t4 = h("div", "panel"); const hd4 = h("div", "phead"); hd4.append(h("span", "", "$ " + p.runner), h("span", "r", "full suite"));
  const tb = h("div", "tests"); const dots = h("div", "dots"); dots.id = "dots";
  const N = window.innerWidth < 760 ? 96 : 128;
  for (let i = 0; i < N; i++) dots.append(h("i"));
  const sum = h("div", "tsum rv"); sum.id = "tsum";
  const pb = h("b", "c-g", (p.total + 1) + " passed"); sum.append(pb, h("span", "", "0 failed"), h("span", "", "1 new test"), h("span", "", "38.4s"));
  tb.append(dots, sum); t4.append(hd4, tb); a4.append(t4);

  // 05 PR
  const a5 = $("#artPR"); a5.innerHTML = "";
  const t5 = h("div", "panel pr");
  const ttl = shortTitle(iss.title);
  const pt = h("div", "pt rv"); pt.append(document.createTextNode("fix: " + ttl + " "), h("span", "", "#" + (n + 7)));
  const pm = h("div", "prmeta rv"); const st = h("span", "prst", "● Open"); st.id = "prState";
  pm.append(st, h("span", "", "merged/fix-" + n + " → main"), h("span", "", "1 commit · +" + adds + " −" + dels));
  const disc = h("div", "disc rv"); disc.append(aiIcon());
  const dt = h("div"); const db = h("b", "", "Opened by MERGED, an AI agent. "); dt.append(db, document.createTextNode("A human maintainer decides if this goes in. If AI PRs aren't welcome here, say so and I'll close it."));
  disc.append(dt);
  const body = h("div", "prbody rv");
  body.append(h("p", "", "Closes #" + n + "."), h("p", "", "Reproduced with a failing test, then patched " + p.files.split(",")[0] + ". Full suite passes locally (" + (p.total + 1) + "/" + (p.total + 1) + ")."));
  const ck = h("div", "chk rv"); ck.append(h("span", "ok", "✓ ci / test"), h("span", "ok", "✓ ci / lint"), h("span", "", "1 file + 1 test changed"));
  t5.append(pt, pm, disc, body, ck); a5.append(t5);

  // 06 review
  const a6 = $("#artReview"); a6.innerHTML = "";
  const th = h("div", "thread");
  const b1 = h("div", "bub rv"); const av1 = h("div", "av", "MA"); const bb1 = h("div", "bb");
  const w1 = h("div", "who"); w1.append(h("b", "", "maintainer"), h("span", "", "reviewed · 14m"));
  bb1.append(w1, h("p", "", "Thanks. Can you also cover the case where the value is empty, not just missing? Keep the public signature the same."));
  b1.append(av1, bb1);
  const b2 = h("div", "bub rv"); b2.id = "agentReply"; const av2 = h("div", "av ag"); av2.append(aiIcon()); const bb2 = h("div", "bb");
  const w2 = h("div", "who"); w2.append(h("b", "", "MERGED"), h("span", "", "AI agent · 3m later"));
  const typing = h("div", "typing"); typing.id = "typing"; typing.append(h("i"), h("i"), h("i"));
  const rp = h("p"); rp.id = "replyText"; rp.hidden = true;
  rp.append(document.createTextNode("Done in "), h("code", "", "7d2e0b4"), document.createTextNode(". Empty and missing both return the default now, signature unchanged. Added one more test, " + (p.total + 2) + " passed."));
  bb2.append(w2, typing, rp); b2.append(av2, bb2);
  th.append(b1, b2); a6.append(th);

  // reset states
  stepEls.forEach(s => { s.className = s.className.replace(/\b(idle|run|done)\b/g, "").trim() + " idle"; $(".st", s).textContent = "queued"; });
  $("#stamp").classList.remove("landed"); $("#mnote").classList.remove("on");
  geoDirty = true; schedule();
}

function shortTitle(t) {
  let s = t.replace(/^\s*\[[^\]]{1,24}\]\s*/, "").replace(/^(bug|fix|feat|feature|issue)\s*[:\-–]\s*/i, "");
  s = s.charAt(0).toLowerCase() + s.slice(1);
  if (s.length > 72) s = s.slice(0, 70).replace(/\s+\S*$/, "") + "…";
  return s;
}

async function setIssue(iss) {
  R.token++; const tok = R.token;
  R.issue = iss; R.idx = -1; R.prog = 0; R.done = new Set();
  R.lang = langOf(iss.repo) || "ts";
  R.wait = !langOf(iss.repo) && !iss.sample;
  renderRun();
  if (R.wait) {
    const L = await resolveLang(iss.repo);
    if (tok !== R.token) return;
    if (L !== R.lang) { R.lang = L; renderRun(); }
    R.wait = false; schedule();
  }
}

function onQueueReady() {
  if (R.issue && !R.issue.sample) return;      // a live issue is already loaded
  if (R.issue && !R.issue.pending && R.idx >= 0) return; // sample run already under way
  setIssue(Q.items.length ? pickIssue() : SAMPLE);
}

/* step players */
const alive = tok => tok === R.token;
function setProg(p) { R.prog = p; schedule(); }
async function typeLines(box, tok, perChar, from, to) {
  const lines = $$(".ln", box);
  const total = lines.length;
  for (let i = 0; i < total; i++) {
    if (!alive(tok)) return;
    const ln = lines[i], tx = $(".tx", ln);
    const cmd = ln.dataset.k === "c";
    if (RM) { ln.classList.add("on", "inst"); continue; }
    if (box.classList.contains("diff")) { ln.classList.add("on", "inst"); await sleep(70); }
    else if (cmd) {
      const n = Math.max(1, (tx.textContent || "").length);
      const d = Math.min(900, Math.max(160, n * perChar));
      tx.style.transition = "clip-path " + d + "ms steps(" + n + ",end)";
      void tx.offsetWidth; ln.classList.add("on"); await sleep(d + 140);
    } else { ln.classList.add("on", "inst"); await sleep(110); }
    setProg(from + (to - from) * ((i + 1) / total));
  }
}
async function reveal(els, tok, gap, from, to) {
  for (let i = 0; i < els.length; i++) {
    if (!alive(tok)) return;
    els[i].classList.add("on");
    setProg(from + (to - from) * ((i + 1) / els.length));
    if (!RM) await sleep(gap);
  }
}
const PLAY = [
  async tok => { const a = $("#artRead"); await reveal($$(".rv", a), tok, 160, 0, .4); await typeLines($(".checks .code", a), tok, 16, .4, 1); },
  async tok => { await typeLines($("#artRepro .code"), tok, 14, 0, 1); },
  async tok => { await typeLines($("#artPatch .code"), tok, 0, 0, 1); },
  async tok => {
    const d = $$("#dots i"); const step = RM ? d.length : 4;
    for (let i = 0; i < d.length; i += step) {
      if (!alive(tok)) return;
      for (let j = i; j < Math.min(d.length, i + step); j++) d[j].classList.add("ok");
      setProg((i + step) / d.length * .92);
      if (!RM) await sleep(34);
    }
    $("#tsum").classList.add("on"); setProg(1); if (!RM) await sleep(250);
  },
  async tok => { await reveal($$("#artPR .rv"), tok, 220, 0, 1); },
  async tok => {
    const rv = $$("#artReview .rv");
    rv[0].classList.add("on"); setProg(.3); if (!RM) await sleep(900);
    if (!alive(tok)) return;
    rv[1].classList.add("on"); setProg(.5); if (!RM) await sleep(1100);
    if (!alive(tok)) return;
    $("#typing").hidden = true; $("#replyText").hidden = false; setProg(1);
    if (!RM) await sleep(300);
  },
  async tok => {
    if (!RM) { const t0 = performance.now(); while (performance.now() - t0 < 950) { if (!alive(tok)) return; setProg((performance.now() - t0) / 950); await sleep(16); } }
    setProg(1);
    if (!alive(tok)) return;
    $("#stamp").classList.add("landed"); $("#mnote").classList.add("on");
    const st = $("#prState"); if (st) { st.textContent = "● Merged"; st.classList.add("m"); }
    if (!RM) await sleep(600);
  }
];

function startStep(k) {
  const tok = R.token;
  R.idx = k; R.prog = 0;
  const el = stepEls[k];
  el.classList.remove("idle"); el.classList.add("run"); $(".st", el).textContent = "running";
  const t0 = performance.now();
  PLAY[k](tok).then(() => {
    if (!alive(tok)) return;
    R.done.add(k); R.prog = 1;
    el.classList.remove("run"); el.classList.add("done");
    $(".st", el).textContent = "done · " + ((performance.now() - t0) / 1000).toFixed(1) + "s";
    schedule();
  });
}

$$("[data-again]").forEach(b => b.addEventListener("click", () => {
  const nx = Q.items.length ? pickIssue() : SAMPLE;
  setIssue(nx);
  const r = $("#runSteps").getBoundingClientRect();
  if (r.top < 0 || r.top > innerHeight) $("#run").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
}));

/* ================= RECEIPTS ================= */
const DEMO_RECEIPTS = [
  { s: "m", title: "fix: handle empty glob patterns in the file watcher", repo: "quarrylabs/tessellate", n: 2184, when: "2h ago", a: 14, d: 3 },
  { s: "m", title: "fix(parser): keep trailing comments on the last node", repo: "northwind-dev/papercut", n: 911, when: "9h ago", a: 22, d: 6 },
  { s: "c", title: "fix: off-by-one in range header parsing", repo: "ovenware/brisk", n: 4402, when: "1d ago", note: "Maintainer asked for no AI PRs. The agent closed it in 2 minutes.", a: 5, d: 2 },
  { s: "m", title: "fix: return an error instead of panicking on a zero-length frame", repo: "lattice-rs/lattice", n: 1377, when: "1d ago", a: 18, d: 4 },
  { s: "o", title: "fix: respect TZ when serialising dates", repo: "hexmoth/shelfdb", n: 658, when: "in review", a: 9, d: 2 }
];
const ST = { m: "merged", c: "closed", o: "open" };
function receiptRow(r, real) {
  const li = h("li");
  const row = h(r.url ? "a" : "div", "rrow");
  if (r.url) { row.href = r.url; row.target = "_blank"; row.rel = "noopener"; }
  const s = h("span", "rs " + r.s, (r.s === "m" ? "● " : r.s === "c" ? "○ " : "◐ ") + ST[r.s]);
  const mid = h("div"); mid.append(h("div", "rt", r.title));
  const meta = h("div", "rr"); meta.append(document.createTextNode(r.repo + " #" + r.n));
  if (r.note) { meta.append(document.createTextNode(" · ")); meta.append(h("em", "", r.note)); }
  mid.append(meta);
  const w = h("div", "rw"); w.append(document.createTextNode(r.when));
  if (r.a != null) { const d = h("span", "d"); d.append(h("span", "a", "+" + r.a), document.createTextNode(" "), h("span", "x", "−" + r.d)); w.append(d); }
  if (!real) { const dm = h("span", "d", "demo"); w.append(dm); }
  row.append(s, mid, w); li.append(row); return li;
}
function countUp(el, to) {
  if (RM || !to) { el.textContent = String(to); return; }
  const t0 = performance.now(), from = 0;
  (function f(t) { const k = Math.min(1, (t - t0) / 900); el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(f); })(t0);
}
async function loadReceipts() {
  const list = $("#rList"), note = $("#scoreNote");
  const gh_ = (CFG.AGENT_GH || "").trim().replace(/^@/, "");
  list.innerHTML = "";
  if (!gh_) {
    $("#sMerged").textContent = "0"; $("#sClosed").textContent = "0"; $("#sOpen").textContent = "0";
    note.innerHTML = "";
    const tg = h("span", "tag demo"); tg.append(h("span", "dot"), document.createTextNode("DEMONSTRATION"));
    note.append(document.createTextNode("Agent not live yet. The counts above are real (zero). The receipts below are examples and don't count. "), tg);
    DEMO_RECEIPTS.forEach(r => list.append(receiptRow(r, false)));
    return;
  }
  const author = /\[bot\]$/.test(gh_) ? "app/" + gh_.replace(/\[bot\]$/, "") : gh_;
  note.textContent = "Loading from GitHub…";
  try {
    const m = await gh(searchPath("is:pr author:" + author + " is:merged", 12), 120000);
    const c = await gh(searchPath("is:pr author:" + author + " is:closed is:unmerged", 6), 120000);
    const o = await gh(searchPath("is:pr author:" + author + " is:open", 6), 120000);
    const mc = m.d.total_count || 0, cc = c.d.total_count || 0, oc = o.d.total_count || 0;
    countUp($("#sMerged"), mc); countUp($("#sClosed"), cc); countUp($("#sOpen"), oc);
    countUp($("#heroCount"), mc);
    const hn = $("#heroCountNote"); hn.textContent = mc ? "merged PRs by @" + gh_ + " · live" : "live · first merge pending"; hn.classList.add("live");
    note.textContent = "Live from GitHub · PRs by @" + gh_ + " · updated " + ago(new Date(m.t).toISOString());
    const rows = [];
    const mapPR = (i, s) => ({ s, title: i.title, repo: (i.repository_url || "").replace(API + "/repos/", ""), n: i.number, url: i.html_url, when: ago(i.closed_at || i.updated_at || i.created_at), ts: i.closed_at || i.updated_at || i.created_at });
    (m.d.items || []).forEach(i => rows.push(mapPR(i, "m")));
    (c.d.items || []).forEach(i => rows.push(mapPR(i, "c")));
    (o.d.items || []).forEach(i => rows.push(mapPR(i, "o")));
    rows.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    if (!rows.length) list.append(h("li", "rempty", "No pull requests yet. The first receipt shows up here."));
    rows.forEach(r => list.append(receiptRow(r, true)));
  } catch (e) {
    $("#sMerged").textContent = "–"; $("#sClosed").textContent = "–"; $("#sOpen").textContent = "–";
    note.textContent = e.kind === "rate" ? "GitHub rate limit hit. Counts come back shortly." : "Couldn't reach GitHub. ";
    const b = h("button", "btn btn-g", "Retry"); b.type = "button"; b.addEventListener("click", loadReceipts); note.append(b);
  }
}

/* ================= GIT GRAPH (fixed canvas, redrawn per frame) ================= */
const cvs = $(".graph"), host = $("main"), ctx = cvs.getContext("2d");
let G = null, geoDirty = true, raf = 0, lastT = 0, mergedAt = 0;
const S = { main: 0, branch: 0 };
const COL = { ghost: "rgba(238,236,231,0.08)", main: "rgba(238,236,231,0.62)", node: "rgba(238,236,231,0.28)", lit: "#EEECE7", ink: "#0A0A0C", p: "#9B6BFF", phi: "#C4A9FF", tick: "rgba(238,236,231,0.13)", ptick: "rgba(155,107,255,0.3)" };

function bez(p0, p1, p2, p3, t) { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; }

function build() {
  geoDirty = false;
  const hr = host.getBoundingClientRect();
  const wrap = $(".hero .wrap").getBoundingClientRect();
  const cs = getComputedStyle(document.documentElement);
  const gut = parseFloat(cs.getPropertyValue("--gut")) || 24, rail = parseFloat(cs.getPropertyValue("--rail")) || 28, br = parseFloat(cs.getPropertyValue("--branch")) || 84;
  const rx = Math.round(wrap.left - hr.left + gut + rail) + .5, bx = Math.round(wrap.left - hr.left + gut + br) + .5;
  const yOf = el => { const r = el.getBoundingClientRect(); return r.top - hr.top + r.height / 2; };
  const leftOf = el => el.getBoundingClientRect().left - hr.left;
  const start = $('[data-node="start"]'), end = $('[data-node="end"]');
  const y0 = yOf(start), y1 = end.getBoundingClientRect().top - hr.top + 30;
  const fork = $("[data-fork]"), fy = yOf(fork.firstElementChild);
  const stepNodes = $$("[data-step]"), sy = stepNodes.map(yOf);
  const mergeEl = $("[data-merge]"), my = yOf(mergeEl);
  const R1 = Math.min(64, (bx - rx) * 1.4 + 20);
  // branch polyline with cumulative lengths
  const pts = [];
  const curve = (ax, ay, c1x, c1y, c2x, c2y, ex, ey) => { for (let i = 0; i <= 48; i++) { const t = i / 48; pts.push([bez(ax, c1x, c2x, ex, t), bez(ay, c1y, c2y, ey, t)]); } };
  curve(rx, fy, rx, fy + R1 * .55, bx, fy + R1 * .45, bx, fy + R1);
  curve(bx, my - R1, bx, my - R1 * .45, rx, my - R1 * .55, rx, my);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const ticks = [];
  const tickTo = (x, y, el, b) => { if (!el) return; const lx = leftOf(el) - 10; if (lx - x > 22) ticks.push([x + 10, y, lx, b]); };
  const mainNodes = [{ y: y0, r: 6 }, { y: fy, r: 6 }];
  tickTo(rx, y0, start); tickTo(rx, fy, fork.firstElementChild);
  $$("[data-node]").filter(e => e !== start && e !== end).forEach(e => { const y = yOf(e); tickTo(rx, y, e); mainNodes.push({ y, r: 6 }); });
  mainNodes.push({ y: y1, r: 4 });
  sy.forEach((y, i) => tickTo(bx, y, stepNodes[i], true));
  tickTo(rx + 8, my, mergeEl, true);
  let W = 0; ticks.forEach(t => W = Math.max(W, t[2])); W = Math.ceil(Math.max(W, bx) + 60);
  G = { rx, bx, y0, y1, fy, sy, my, mergeStart: my - R1, pts, cum, brL: cum[cum.length - 1], mainL: y1 - y0, mainNodes, ticks, W };
  S.main = Math.min(S.main, G.mainL); S.branch = Math.min(S.branch, G.brL);
  sizeCanvas();
}
let CW = 0, CH = 0, DPR = 1;
function sizeCanvas() {
  const w = G ? G.W : 300, hgt = window.innerHeight + 160, d = Math.min(2, window.devicePixelRatio || 1);
  if (w === CW && hgt === CH && d === DPR) return;
  CW = w; CH = hgt; DPR = d;
  cvs.width = Math.round(w * d); cvs.height = Math.round(hgt * d);
  cvs.style.width = w + "px"; cvs.style.height = hgt + "px";
}

function lenAtY(y) {
  const { pts, cum } = G;
  if (y <= pts[0][1]) return 0;
  if (y >= pts[pts.length - 1][1]) return G.brL;
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][1] < y) lo = m; else hi = m; }
  const k = (y - pts[lo][1]) / ((pts[hi][1] - pts[lo][1]) || 1);
  return cum[lo] + (cum[hi] - cum[lo]) * k;
}
function ptAt(l) {
  const { pts, cum } = G;
  if (l <= 0) return pts[0];
  if (l >= G.brL) return pts[pts.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < l) lo = m; else hi = m; }
  const k = (l - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * k, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * k];
}
function branchPath(upto) {
  const { pts, cum } = G;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] >= upto) { const p = ptAt(upto); ctx.lineTo(p[0], p[1]); return; }
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
}

function headY() {
  const hr = host.getBoundingClientRect();
  const vh = innerHeight, docH = document.documentElement.scrollHeight;
  const toBottom = docH - (scrollY + vh);
  const t = Math.max(0, Math.min(1, 1 - toBottom / (vh * .5)));
  return -hr.top + vh * (.7 + .3 * t);
}
function capY() {
  // the branch grows alongside the step that is running: node i -> node i+1
  const ny = G.sy.concat([G.mergeStart, G.my]);
  if (R.idx < 0) return ny[0];
  const i = R.idx;
  if (R.done.has(i)) return i >= 6 ? Infinity : ny[i + 1];
  return ny[i] + (ny[i + 1] - ny[i]) * Math.max(0, Math.min(1, R.prog));
}
function circle(x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}

function frame(now) {
  raf = 0;
  now = now || performance.now();
  const dt = Math.min(100, lastT ? now - lastT : 16); lastT = now;
  if (geoDirty || !G) build();
  // intro: on the first screen the branch already peels off main
  const hy = Math.max(headY(), G.fy + (innerWidth < 760 ? 150 : 230));
  const ny = G.sy.concat([G.my]);
  const next = R.idx + 1;
  if (R.issue && !R.issue.pending && !R.wait && next < 7 && (R.idx < 0 || R.done.has(R.idx)) && hy >= ny[next] - 30) startStep(next);

  const tMain = Math.max(0, Math.min(G.mainL, hy - G.y0));
  const cy = capY();
  const tBr = Math.min(lenAtY(hy), cy === Infinity ? G.brL : lenAtY(cy));
  let anim = false;
  if (RM) { S.main = tMain; S.branch = tBr; }
  else {
    const dm = tMain - S.main, db = tBr - S.branch;
    const km = 1 - Math.exp(-dt / 70), kb = 1 - Math.exp(-dt / 110);
    S.main += Math.abs(dm) < .5 ? dm : dm * km;
    S.branch += Math.abs(db) < .5 ? db : db * kb;
    anim = Math.abs(dm) >= .5 || Math.abs(db) >= .5;
  }

  // draw (document y -> viewport y via offset)
  const off = host.getBoundingClientRect().top;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, CW, CH);
  ctx.translate(0, off);
  const vis0 = -off - 80, vis1 = -off + CH;
  const { rx, bx } = G;
  ctx.lineCap = "round";
  // main
  ctx.lineWidth = 2; ctx.strokeStyle = COL.ghost;
  ctx.beginPath(); ctx.moveTo(rx, Math.max(G.y0, vis0)); ctx.lineTo(rx, Math.min(G.y1, vis1)); ctx.stroke();
  const mHead = G.y0 + S.main;
  if (mHead > vis0) { ctx.strokeStyle = COL.main; ctx.beginPath(); ctx.moveTo(rx, Math.max(G.y0, vis0)); ctx.lineTo(rx, Math.min(mHead, vis1)); ctx.stroke(); }
  // ticks
  ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
  G.ticks.forEach(t => { if (t[1] < vis0 || t[1] > vis1) return; ctx.strokeStyle = t[3] ? COL.ptick : COL.tick; ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[2], t[1]); ctx.stroke(); });
  // branch ghost
  if (G.fy < vis1 && G.my > vis0) {
    ctx.setLineDash([2, 7]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(155,107,255,0.22)";
    branchPath(G.brL); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (S.branch > .5 && G.fy < vis1 && G.my > vis0) {
    ctx.strokeStyle = "rgba(155,107,255,0.16)"; ctx.lineWidth = 9; branchPath(S.branch); ctx.stroke();
    ctx.strokeStyle = COL.p; ctx.lineWidth = 2.5; branchPath(S.branch); ctx.stroke();
  }
  { const on = R.done.has(6) || (R.idx === 6 && R.prog >= 1); if (on && !mergedAt) mergedAt = now; if (!on) mergedAt = 0; }
  // after the merge, main carries the purple downstream
  const merged = R.done.has(6) && mergedAt;
  if (merged && mHead > G.my) {
    const k = RM ? 1 : Math.min(1, (now - mergedAt) / 1400), end = G.my + (Math.min(mHead, G.y1) - G.my) * (1 - Math.pow(1 - k, 3));
    if (k < 1) anim = true;
    const a = Math.max(G.my, vis0), z = Math.min(end, vis1);
    if (z > a) {
      ctx.strokeStyle = "rgba(155,107,255,0.16)"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(rx, a); ctx.lineTo(rx, z); ctx.stroke();
      ctx.strokeStyle = COL.p; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(rx, a); ctx.lineTo(rx, z); ctx.stroke();
    }
    G.purpleTo = end;
  } else G.purpleTo = 0;
  // main nodes
  G.mainNodes.forEach(n => {
    if (n.y < vis0 || n.y > vis1) return;
    const lit = n.y <= mHead + 1, pur = G.purpleTo && n.y > G.my && n.y <= G.purpleTo + 1;
    circle(rx, n.y, n.r, pur ? COL.p : lit ? COL.lit : COL.ink, pur ? COL.p : lit ? COL.lit : COL.node, 2);
  });
  // branch nodes
  G.sy.forEach((y, i) => {
    if (y < vis0 || y > vis1) return;
    const running = R.idx === i && !R.done.has(i);
    if (R.done.has(i)) circle(bx, y, 6.5, COL.p, COL.p, 2);
    else if (running) {
      const pulse = RM ? 0 : (Math.sin(now / 160) + 1) / 2;
      if (!RM) { ctx.globalAlpha = .25 * (1 - pulse); circle(bx, y, 9 + pulse * 7, COL.p); ctx.globalAlpha = 1; anim = true; }
      circle(bx, y, 6.5, COL.ink, COL.p, 2.5);
    } else circle(bx, y, 6.5, COL.ink, "rgba(155,107,255,0.4)", 2);
  });
  // merge node
  if (G.my > vis0 && G.my < vis1) {
    const on = R.done.has(6) || (R.idx === 6 && R.prog >= 1);
    const t = on ? (RM ? 99 : (now - mergedAt) / 1000) : 0;
    if (on && t < 1.6) anim = true;
    if (on && t < 1.3) { const k = t / 1.3; ctx.globalAlpha = .9 * (1 - k); circle(rx, G.my, 16 + 36 * k, null, COL.p, 2); ctx.globalAlpha = 1; }
    circle(rx, G.my, 15, COL.ink, on ? COL.p : "rgba(155,107,255,0.35)", on ? 3 : 2);
    if (on) { const s = t >= .5 ? 1 : 1 + Math.sin(t / .5 * Math.PI) * .25 * (1 - t / .5) - (1 - Math.min(1, t / .25)) * .8; circle(rx, G.my, 9 * Math.max(.2, s), COL.p); }
  }
  // heads
  if (mHead > vis0 && mHead < vis1 && S.main < G.mainL - 1) circle(rx, mHead, 3, COL.lit);
  if (S.branch > 2 && S.branch < G.brL - 2) {
    const p = ptAt(S.branch);
    if (p[1] > vis0 && p[1] < vis1) { ctx.globalAlpha = .25; circle(p[0], p[1], 9, COL.p); ctx.globalAlpha = 1; circle(p[0], p[1], 3.5, COL.phi); }
  }
  cvs.dataset.branch = (S.branch / G.brL).toFixed(3);
  if (anim) schedule(); else lastT = 0;
}
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", () => { geoDirty = true; sizeCanvas(); schedule(); });
if (window.ResizeObserver) new ResizeObserver(() => { geoDirty = true; schedule(); }).observe(host);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { geoDirty = true; schedule(); });

/* fee bar reveal */
const split = $("#split");
if ("IntersectionObserver" in window && !RM) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { split.classList.add("on"); io.disconnect(); } }), { threshold: .4 });
  io.observe(split);
} else split.classList.add("on");

/* boot */
setIssue(Object.assign({}, SAMPLE, { pending: true, repo: "…/…", number: 0, title: "Loading an issue from the live queue…", labels: [] }));
loadQueue(false);
loadReceipts();
schedule();
})();
