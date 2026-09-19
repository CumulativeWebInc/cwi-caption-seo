# Caption SEO Analyzer — CWI Agent Deck

**Live:** https://cumulativewebinc.github.io/cwi-caption-seo/

A $0 deterministic text-analysis tool (APP-IDEAS #49). Paste a draft caption,
on-screen text, and spoken-audio transcript; it checks keyword coverage of the
track title / artist name across all three slots (TikTok SEO reads all three in
2026), flags missing keyword slots, and validates hashtag counts per platform
(Instagram 3–5, Threads 1, TikTok 1–2).

- **Zero dependencies. Works offline.** Pure HTML + JS, no network calls, nothing leaves the browser.
- **Honest by design:** empty input returns "insufficient input," never a score. Hashtag guidance is labeled 2026-research-based (see `docs/RESEARCH.md`).
- **Shareable:** `?share=<base64>` deep links restore any analysis.

## Files

| File | Purpose |
|------|---------|
| `docs/index.html` | The app (UI + share-link logic) |
| `docs/seo.js` | Core analyzer (UMD — browser + Node) |
| `docs/RESEARCH.md` | Research basis for hashtag guidance |
| `test/test.js` | Node test suite (stdlib only): `node test/test.js` |

## Scoring model (documented heuristic, v1)

Keyword tokens = words from title + artist, lowercased, punctuation stripped,
tokens under 2 chars dropped. A token is covered in a slot on whole-word match.
`coverageScore = 100 × Σ(tokenWeight × coveredSlots/3) / Σ(tokenWeight)`,
title tokens weight 2, artist tokens weight 1. Bands: 90+ Excellent, 70+ Good,
40+ Needs work, else Weak.

## License

© 2026 Cumulative Web Inc. Free for personal, development, and evaluation use.
Commercial use requires a license — contact hp@cumulativeweb.com.

## Kill rule

Lane dies if third-party uses < 25 in 60 days.
