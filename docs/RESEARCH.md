# Research basis — Caption SEO Analyzer v1.0.0

This file documents where the analyzer's guidance comes from. The analyzer is
**deterministic text analysis**; it invents no platform data. Only the hashtag
ranges below come from outside research, and they are labeled 2026-research-based,
not platform-verified.

## Product spec source

- `~/workspace/cwi-company/apps/APP-IDEAS.md`, entry **#49 · Caption SEO Analyzer**
  (marked **Build-ready**, scored in the CWI software-brand expansion sprint 2026-09-16).
  Spec: "checks that caption keywords + on-screen text + spoken audio cover the
  track title/artist name (TikTok SEO is a direct 2026 ranking factor), flags missing
  keyword slots, validates hashtag counts per platform (IG 3-5, Threads 1, TikTok 1-2).
  Pure text analysis, $0, deterministic."

## Why keyword coverage matters (2026)

- TikTok's own public guidance (2026) states that its search and recommendation
  surfaces read **video captions, on-screen text, and spoken audio** — all three
  are keyword inputs for discoverability. The analyzer treats exactly these three
  slots.
- Music-discovery practice in 2026 (CWI's own sync-discovery research, Black's
  2026-09-16 music-supervisor AI discovery landscape): machine-discoverability —
  rich, repeated, machine-readable descriptors including track title and artist
  name — drives AI-mediated discovery (AIMS, Cyanite-style systems, and TikTok
  SEO). Repeating the title/artist across slots is the deterministic, $0 version
  of that principle.

## Hashtag ranges (2026-research-based, NOT platform-verified)

| Platform  | Range used | Research basis |
|-----------|-----------|----------------|
| Instagram | 3–5       | 2026 creator/marketing research consensus: Instagram officially recommends a small handful of relevant hashtags; over-tagging is treated as spam-adjacent and dilutes relevance. The analyzer's 3–5 band encodes "a focused handful," below the old 30-tag maximum, reflecting the 2026 guidance. |
| Threads   | 1         | 2026 Threads best practice: a single topic tag per post (the platform's tag model is one-topic-per-post). The analyzer expects exactly 1. |
| TikTok    | 1–2       | 2026 TikTok SEO practice: captions with 1–2 highly relevant hashtags; keyword-rich natural language carries more weight than tag stuffing. |

These are **guidance**, presented in-app as 2026-research-based. The analyzer
never claims they are platform-verified truth — see the Honest-limits panel in
`index.html`. If 2026 research updates these ranges, update
`PLATFORM_GUIDANCE` in `seo.js` and this table together.

## What is NOT research-based (pure tool logic)

- The coverage scoring formula, token weights, grade bands, and slot definitions
  are the tool's own documented heuristics (see the header comment of `seo.js`).
- The analyzer does not predict reach, ranking, or virality. It reports keyword
  presence and hashtag counts — nothing more.
