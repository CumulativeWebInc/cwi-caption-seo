/* CaptionSEO v1.0.0 — zero-dependency deterministic caption keyword analyzer.
 *
 * Pure text analysis. No network calls, no fabricated platform data.
 * Works in the browser (window.CaptionSEO) and in Node (module.exports).
 *
 * ANALYSIS MODEL (documented, fixed for v1 — heuristics, not platform truth):
 *   - Keyword tokens = alphanumeric words from the track title + artist name,
 *     lowercased, punctuation stripped, tokens shorter than 2 chars dropped.
 *   - Three searchable slots: caption, on-screen text, spoken transcript.
 *   - A token is "covered" in a slot if it appears as a whole word there.
 *   - coverageScore = 100 * sum(tokenWeight * coveredSlots/3) / sum(tokenWeight),
 *     rounded to an integer. Title tokens weight 2, artist tokens weight 1.
 *   - Grade bands are heuristic labels only: 90+ Excellent · 70+ Good · 40+ Needs work · else Weak.
 *   - Hashtag guidance (IG 3–5, Threads 1, TikTok 1–2) is 2026-research-based;
 *     see docs/RESEARCH.md. The analyzer counts, it never invents data.
 */
(function (root, factory) {
  if (typeof module === "object" && module !== null && module.exports) {
    module.exports = factory();
  } else {
    root.CaptionSEO = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PLATFORM_GUIDANCE = {
    instagram: { label: "Instagram", min: 3, max: 5 },
    threads: { label: "Threads", min: 1, max: 1 },
    tiktok: { label: "TikTok", min: 1, max: 2 },
  };
  var SLOT_NAMES = ["caption", "onscreen", "transcript"];
  var SLOT_LABELS = { caption: "Caption", onscreen: "On-screen text", transcript: "Spoken transcript" };

  function isBlank(s) {
    return !s || !String(s).trim();
  }

  function tokenize(text) {
    // Lowercase, strip punctuation/emoji to spaces, split on whitespace, drop <2-char tokens.
    return String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter(function (t) { return t.length >= 2; });
  }

  function wordSet(text) {
    var set = {};
    tokenize(text).forEach(function (t) { set[t] = true; });
    return set;
  }

  function keywordTokens(title, artist) {
    // Title tokens weight 2, artist tokens weight 1. Dedupe; title wins ties.
    var out = [];
    var seen = {};
    tokenize(title).forEach(function (t) {
      if (!seen[t]) { seen[t] = true; out.push({ token: t, source: "title", weight: 2 }); }
    });
    tokenize(artist).forEach(function (t) {
      if (!seen[t]) { seen[t] = true; out.push({ token: t, source: "artist", weight: 1 }); }
    });
    return out;
  }

  function extractHashtags(text) {
    var tags = [];
    var seen = {};
    var re = /#([\p{L}\p{N}_]{1,139})/gu;
    var m;
    while ((m = re.exec(String(text || ""))) !== null) {
      var tag = m[1].toLowerCase();
      if (!seen[tag]) { seen[tag] = true; tags.push(tag); }
    }
    return tags;
  }

  function grade(score) {
    if (score >= 90) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 40) return "Needs work";
    return "Weak";
  }

  function analyze(opts) {
    opts = opts || {};
    var title = String(opts.title || "").trim();
    var artist = String(opts.artist || "").trim();
    var caption = String(opts.caption || "");
    var onscreen = String(opts.onscreen || "");
    var transcript = String(opts.transcript || "");
    var platform = String(opts.platform || "instagram").toLowerCase();
    if (!PLATFORM_GUIDANCE[platform]) platform = "instagram";

    var guidance = PLATFORM_GUIDANCE[platform];

    // --- Insufficient input gate: nothing to analyze at all. ---
    var anyText = !isBlank(caption) || !isBlank(onscreen) || !isBlank(transcript);
    var keywords = keywordTokens(title, artist);
    if (!anyText || keywords.length === 0) {
      return {
        version: "1.0.0",
        status: "insufficient-input",
        message: "Insufficient input: provide at least one of caption, on-screen text, or transcript, AND a track title or artist name. No score was produced.",
        platform: platform,
        platformLabel: guidance.label,
        hashtags: hashtagReport(caption, platform),
        keywords: [],
        coverageScore: null,
        grade: null,
        missingSlots: [],
        slotCoverage: {},
        checklist: [],
      };
    }

    var slots = { caption: wordSet(caption), onscreen: wordSet(onscreen), transcript: wordSet(transcript) };
    var slotHitCounts = { caption: 0, onscreen: 0, transcript: 0 };
    var weightedCovered = 0;
    var weightedTotal = 0;
    var keywordRows = [];
    var missingSlots = [];

    keywords.forEach(function (k) {
      var hits = {};
      var covered = 0;
      SLOT_NAMES.forEach(function (s) {
        var hit = !!slots[s][k.token];
        hits[s] = hit;
        if (hit) { covered += 1; slotHitCounts[s] += 1; }
      });
      weightedCovered += k.weight * (covered / SLOT_NAMES.length);
      weightedTotal += k.weight;

      var missing = SLOT_NAMES.filter(function (s) { return !hits[s]; });
      if (covered < SLOT_NAMES.length) {
        missingSlots.push({
          token: k.token,
          source: k.source,
          presentIn: SLOT_NAMES.filter(function (s) { return hits[s]; }),
          missingIn: missing,
          severity: covered === 0 ? "missing-everywhere" : "partial",
        });
      }
      keywordRows.push({ token: k.token, source: k.source, weight: k.weight, slots: hits, coveredSlots: covered });
    });

    var score = weightedTotal > 0 ? Math.round((100 * weightedCovered) / weightedTotal) : 0;
    var slotCoverage = {};
    SLOT_NAMES.forEach(function (s) {
      slotCoverage[s] = { covered: slotHitCounts[s], total: keywords.length };
    });

    var checklist = [];
    missingSlots.forEach(function (m) {
      if (m.severity === "missing-everywhere") {
        checklist.push({
          kind: "missing-everywhere",
          token: m.token,
          text: 'Keyword "' + m.token + '" (' + m.source + ') appears in NONE of the 3 slots. TikTok indexes caption + on-screen text + speech — add it to at least one.',
        });
      } else {
        checklist.push({
          kind: "partial",
          token: m.token,
          text: 'Keyword "' + m.token + '" (' + m.source + ') is missing in: ' +
            m.missingIn.map(function (s) { return SLOT_LABELS[s]; }).join(", ") + ".",
        });
      }
    });

    return {
      version: "1.0.0",
      status: "ok",
      message: "Analysis complete.",
      platform: platform,
      platformLabel: guidance.label,
      title: title,
      artist: artist,
      keywords: keywordRows,
      coverageScore: score,
      grade: grade(score),
      slotCoverage: slotCoverage,
      missingSlots: missingSlots,
      hashtags: hashtagReport(caption, platform),
      checklist: checklist,
    };
  }

  function hashtagReport(caption, platform) {
    var guidance = PLATFORM_GUIDANCE[platform] || PLATFORM_GUIDANCE.instagram;
    var tags = extractHashtags(caption);
    var count = tags.length;
    var status, note;
    if (count === 0) {
      status = "fail";
      note = "No hashtags found. Per 2026-research-based guidance (" + guidance.label + " target " + guidance.min + "–" + guidance.max + "), add relevant tags — this is a TikTok SEO ranking input.";
    } else if (count < guidance.min) {
      status = "warn";
      note = count + " hashtag" + (count === 1 ? "" : "s") + " — below the " + guidance.min + "–" + guidance.max + " research-based range for " + guidance.label + ". Add " + (guidance.min - count) + " more relevant tag" + (guidance.min - count === 1 ? "" : "s") + ".";
    } else if (count > guidance.max) {
      status = "warn";
      note = count + " hashtags — above the " + guidance.min + "–" + guidance.max + " research-based range for " + guidance.label + ". Over-tagging dilutes relevance; trim to the top " + guidance.max + ".";
    } else {
      status = "pass";
      note = count + " hashtag" + (count === 1 ? "" : "s") + " — inside the " + guidance.min + "–" + guidance.max + " research-based range for " + guidance.label + ".";
    }
    return {
      tags: tags,
      count: count,
      platform: platform,
      platformLabel: guidance.label,
      range: { min: guidance.min, max: guidance.max },
      status: status, // pass | warn | fail — counts only, no platform data invented
      note: note,
      guidanceSource: "2026-research-based ranges; see RESEARCH.md",
    };
  }

  function platformGuidance() {
    var out = {};
    Object.keys(PLATFORM_GUIDANCE).forEach(function (k) {
      out[k] = { label: PLATFORM_GUIDANCE[k].label, min: PLATFORM_GUIDANCE[k].min, max: PLATFORM_GUIDANCE[k].max };
    });
    return out;
  }

  return {
    version: "1.0.0",
    analyze: analyze,
    hashtagReport: hashtagReport,
    extractHashtags: extractHashtags,
    tokenize: tokenize,
    platformGuidance: platformGuidance,
  };
});
