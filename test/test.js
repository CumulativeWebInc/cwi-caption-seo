/* Caption SEO Analyzer — Node test suite (stdlib only).
 * Run: node test/test.js
 * Exit 0 = all pass; exit 1 = any failure.
 */
"use strict";
const path = require("path");
const SEO = require(path.join(__dirname, "..", "docs", "seo.js"));

let passed = 0, failed = 0;
const failures = [];

function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; failures.push(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`); }
}
function ok(cond, name) { eq(cond, true, name); }

// ---------- 1. Keyword coverage scoring ----------
{
  const r = SEO.analyze({
    title: "Diabolique", artist: "That Boy Hi Hat",
    caption: "New single Diabolique out now — That Boy Hi Hat",
    onscreen: "DIABOLIQUE — That Boy Hi Hat", transcript: "that boy hi hat diabolique",
    platform: "instagram",
  });
  ok(r.status === "ok", "coverage: status ok");
  eq(r.coverageScore, 100, "coverage: full coverage = 100");
  eq(r.grade, "Excellent", "coverage: 100 = Excellent");
  eq(r.missingSlots.length, 0, "coverage: no missing slots");
}

{
  // Only caption covers title; artist absent everywhere.
  const r = SEO.analyze({
    title: "Diabolique", artist: "That Boy Hi Hat",
    caption: "Diabolique out now", onscreen: "", transcript: "",
    platform: "tiktok",
  });
  ok(r.status === "ok", "partial: status ok");
  ok(r.coverageScore < 100 && r.coverageScore > 0, "partial: 0 < score < 100");
  // diabolique: weight 2, covered 1/3 slots => 2/3. that,boy,hi,hat: weight 1 each, 0/3.
  // total weight = 2+4=6; weighted covered = 2*(1/3)=0.6667 => 11.11 => 11
  eq(r.coverageScore, 11, "partial: score formula exact (11)");
  const artistMissing = r.missingSlots.filter(m => m.source === "artist").map(m => m.token).sort();
  eq(artistMissing, ["boy", "hat", "hi", "that"], "partial: artist tokens flagged missing-everywhere");
  ok(r.missingSlots.filter(m => m.source === "artist").every(m => m.severity === "missing-everywhere"), "partial: severity missing-everywhere");
  const di = r.missingSlots.find(m => m.token === "diabolique");
  ok(!!di && di.severity === "partial" && di.missingIn.join(",") === "onscreen,transcript",
    "partial: title token partial, missing onscreen+transcript");
}

// ---------- 2. Missing-slot flags content ----------
{
  const r = SEO.analyze({
    title: "Zooted Zone", artist: "That Boy Hi Hat",
    caption: "zooted", onscreen: "zone", transcript: "that boy hi hat",
    platform: "instagram",
  });
  ok(r.checklist.length > 0, "flags: checklist non-empty");
  ok(r.checklist.every(c => typeof c.text === "string" && c.text.includes('"')), "flags: checklist items quote the token");
  const zooted = r.missingSlots.find(m => m.token === "zooted");
  ok(!!zooted && zooted.severity === "partial", "flags: zooted partial");
  ok(r.slotCoverage.caption.covered === 1 && r.slotCoverage.onscreen.covered === 1 && r.slotCoverage.transcript.covered === 4,
    "flags: slot totals correct");
}

// ---------- 3. Hashtag-count validation per platform ----------
{
  const h = SEO.hashtagReport("#a #b #c #d", "instagram");
  eq(h.count, 4, "ig: 4 tags counted"); eq(h.status, "pass", "ig: 4 = pass");
  const h2 = SEO.hashtagReport("#a", "instagram");
  eq(h2.status, "warn", "ig: 1 = warn (below 3-5)");
  const h3 = SEO.hashtagReport("#a #b #c #d #e #f", "instagram");
  eq(h3.status, "warn", "ig: 6 = warn (above 3-5)");
  const h4 = SEO.hashtagReport("no tags here", "instagram");
  eq(h4.status, "fail", "ig: 0 = fail");
}
{
  const h = SEO.hashtagReport("#posttrap", "threads");
  eq(h.status, "pass", "threads: 1 = pass");
  const h2 = SEO.hashtagReport("#a #b", "threads");
  eq(h2.status, "warn", "threads: 2 = warn (above 1)");
}
{
  const h = SEO.hashtagReport("#a #b", "tiktok");
  eq(h.status, "pass", "tiktok: 2 = pass");
  const h2 = SEO.hashtagReport("#a #b #c", "tiktok");
  eq(h2.status, "warn", "tiktok: 3 = warn (above 1-2)");
  const h3 = SEO.hashtagReport("", "tiktok");
  eq(h3.status, "fail", "tiktok: 0 = fail");
}
{
  // Unknown platform falls back to instagram guidance.
  const r = SEO.analyze({ title: "X", artist: "Y", caption: "#a #b #c", platform: "myspace" });
  eq(r.hashtags.platform, "instagram", "hashtag: unknown platform -> instagram fallback");
  eq(r.hashtags.guidanceSource, "2026-research-based ranges; see RESEARCH.md", "hashtag: guidance labeled 2026-research-based");
}

// ---------- 4. Insufficient input — honest, never a score ----------
{
  const r = SEO.analyze({ title: "", artist: "", caption: "", onscreen: "", transcript: "" });
  eq(r.status, "insufficient-input", "empty: status insufficient-input");
  eq(r.coverageScore, null, "empty: score is null, not 0");
  eq(r.grade, null, "empty: grade is null");
  ok(/Insufficient input/.test(r.message), "empty: honest message");
}
{
  const r = SEO.analyze({ title: "", artist: "", caption: "some caption text", platform: "threads" });
  eq(r.status, "insufficient-input", "no-keywords: insufficient-input even with caption text");
  eq(r.coverageScore, null, "no-keywords: no score");
}
{
  const r = SEO.analyze({ title: "Diabolique", artist: "", caption: "   ", onscreen: "", transcript: "" });
  eq(r.status, "insufficient-input", "whitespace-only: insufficient-input");
}
{
  // Title of punctuation only -> no keyword tokens -> insufficient input.
  const r = SEO.analyze({ title: "!!!", artist: "...", caption: "hello world", platform: "instagram" });
  eq(r.status, "insufficient-input", "punct-title: no tokens -> insufficient-input");
}

// ---------- 5. Edge cases ----------
{
  // Case-insensitive + punctuation-tolerant matching.
  const r = SEO.analyze({
    title: "Diabolique", artist: "That Boy Hi Hat",
    caption: "DIABOLIQUE!!! Out-now…", onscreen: "", transcript: "",
    platform: "instagram",
  });
  const di = r.keywords.find(k => k.token === "diabolique");
  ok(!!di && di.slots.caption === true, "edge: case + punctuation tolerant");
}
{
  // Hyphenated title tokenizes to separate words; both must match.
  const r = SEO.analyze({
    title: "Post-Trap Futurism", artist: "",
    caption: "post trap futurism radio", onscreen: "", transcript: "",
    platform: "instagram",
  });
  eq(r.keywords.map(k => k.token), ["post", "trap", "futurism"], "edge: hyphen splits");
}
{
  // Duplicate hashtags counted once; unicode tags supported.
  const tags = SEO.extractHashtags("#AltRap #altrap #PostTrapFuturism #post-trap");
  eq(tags, ["altrap", "posttrapfuturism", "post"], "edge: hashtag dedupe + lowercase + hyphen split");
}
{
  // One-char tokens dropped from keywords (a/an/I style noise).
  const r = SEO.analyze({ title: "A B C", artist: "", caption: "a b c d", platform: "instagram" });
  eq(r.status, "insufficient-input", "edge: single-char tokens dropped -> insufficient input");
}
{
  // Title phrase + artist overlap dedupe: title wins, no double count.
  const r = SEO.analyze({ title: "Hi Hat", artist: "That Boy Hi Hat", caption: "hi hat", platform: "instagram" });
  const tokens = r.keywords.map(k => k.token);
  eq(tokens, ["hi", "hat", "that", "boy"], "edge: overlap dedupe, title-first order");
}
{
  // platformGuidance exposes all three platforms with documented ranges.
  const g = SEO.platformGuidance();
  eq([g.instagram.min, g.instagram.max, g.threads.min, g.threads.max, g.tiktok.min, g.tiktok.max],
     [3, 5, 1, 1, 1, 2], "guidance: ranges IG 3-5 / Threads 1 / TikTok 1-2");
}
{
  // Score is deterministic across runs.
  const input = { title: "Diabolique", artist: "That Boy Hi Hat", caption: "diabolique", onscreen: "hi hat", transcript: "boy" };
  eq(SEO.analyze(input).coverageScore, SEO.analyze(input).coverageScore, "determinism: same input -> same score");
  eq(JSON.stringify(SEO.analyze(input).missingSlots), JSON.stringify(SEO.analyze(input).missingSlots), "determinism: same flags");
}

// ---------- report ----------
console.log(`\nCaption SEO Analyzer tests: ${passed} passed, ${failed} failed`);
failures.forEach(f => console.log(f));
process.exit(failed === 0 ? 0 : 1);
