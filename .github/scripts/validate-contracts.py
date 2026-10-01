#!/usr/bin/env python3
"""CWI trust-infra contract validator — A7/A8/A9 gate.

Runs in CI on every PR and every push to main. FAILS (exit 1) when:
  1. <site>/.well-known/agent-card.json is missing, not valid JSON,
     or lacks non-empty `name` / `url` (agent-cards required on everything).
  2. SCHEMA-VERSIONS.json exists and a registered document is missing or its
     schema_version does not match the registry (ultimate's contract; additive).
  3. <site>/content.json exists but is not valid JSON.
  4. CHANGELOG.md is missing at the repo root or empty.
  5. API-VERSION exists but openapi.json info.version does not match the pin.

Always writes a compact JSON report (--json-out) so the PR-preview workflow
can post a checklist reflecting the ACTUAL CI results.
"""
import argparse
import json
import os
import sys


def check(cid, ok, detail):
    return {"id": cid, "pass": bool(ok), "detail": detail}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site-dir", default=".")
    ap.add_argument("--repo", default="")
    ap.add_argument("--json-out", default="/tmp/contract-report.json")
    a = ap.parse_args()
    site = a.site_dir if a.site_dir != "." else "."
    checks = []

    # 1. agent-card
    card_path = os.path.join(site, ".well-known", "agent-card.json")
    try:
        with open(card_path, encoding="utf-8") as fh:
            card = json.load(fh)
        ok = isinstance(card, dict) and bool(card.get("name")) and bool(card.get("url"))
        checks.append(check("agent-card", ok,
                            f"{card_path}: valid, name={card.get('name')!r}" if ok
                            else f"{card_path}: invalid — requires non-empty name and url"))
    except FileNotFoundError:
        checks.append(check("agent-card", False, f"{card_path}: MISSING (agent-cards required on everything)"))
    except json.JSONDecodeError as e:
        checks.append(check("agent-card", False, f"{card_path}: invalid JSON ({e})"))

    # 2. SCHEMA-VERSIONS.json contract (only where the registry exists)
    reg_path = "SCHEMA-VERSIONS.json"
    if os.path.exists(reg_path):
        try:
            with open(reg_path, encoding="utf-8") as fh:
                reg = json.load(fh)
            if not isinstance(reg, dict) or not reg.get("schema_version"):
                checks.append(check("schema-versions", False,
                                    "SCHEMA-VERSIONS.json: registry itself lacks schema_version"))
            else:
                # Registry shapes in the wild:
                #  (1) flat:        {"path/to/doc.json": "1.0.0", ...}            (ultimate)
                #  (2) nested flat: {"registry": {"path/to/doc.json": "1.0.0"}}  (generic)
                #  (3) version->file: {"registry": {"1.0.0": {"file": "path/to/doc.json"}}} (agent-deck)
                entries = reg.get("registry") if isinstance(reg.get("registry"), dict) else reg
                bad = []
                SKIP_KEYS = {"schema_version", "default", "note", "registry"}
                for key, val in entries.items():
                    if key.startswith("$") or key.startswith("how_to_") or key in SKIP_KEYS:
                        continue
                    if isinstance(val, str):
                        path, expected = key, val                      # shapes 1, 2
                    elif isinstance(val, dict) and isinstance(val.get("file"), str):
                        path, expected = val["file"], key              # shape 3
                    else:
                        continue  # unrecognized entry shape — never fail on what we don't understand
                    if not os.path.exists(path):
                        bad.append(f"{path}: registered but missing")
                        continue
                    try:
                        with open(path, encoding="utf-8") as fh:
                            doc = json.load(fh)
                    except Exception as e:  # noqa: BLE001
                        bad.append(f"{path}: invalid JSON ({e})")
                        continue
                    got = doc.get("schema_version") if isinstance(doc, dict) else None
                    if str(got) != str(expected):
                        bad.append(f"{path}: schema_version={got!r} != registry {expected!r}")
                checks.append(check("schema-versions", not bad,
                                    "SCHEMA-VERSIONS.json: all registered documents match"
                                    if not bad else "SCHEMA-VERSIONS.json: " + "; ".join(bad)))
        except json.JSONDecodeError as e:
            checks.append(check("schema-versions", False, f"SCHEMA-VERSIONS.json: invalid JSON ({e})"))
    else:
        checks.append(check("schema-versions", True, "no SCHEMA-VERSIONS.json registry in this repo — skipped"))

    # 3. content.json validity (only if present)
    content_path = os.path.join(site, "content.json")
    if os.path.exists(content_path):
        try:
            with open(content_path, encoding="utf-8") as fh:
                json.load(fh)
            checks.append(check("content-json", True, f"{content_path}: valid JSON"))
        except json.JSONDecodeError as e:
            checks.append(check("content-json", False, f"{content_path}: invalid JSON ({e})"))
    else:
        checks.append(check("content-json", True, f"{content_path}: absent — skipped"))

    # 4. CHANGELOG.md presence
    if os.path.exists("CHANGELOG.md") and os.path.getsize("CHANGELOG.md") > 0:
        checks.append(check("changelog", True, "CHANGELOG.md: present"))
    else:
        checks.append(check("changelog", False, "CHANGELOG.md: MISSING (every product ships a changelog)"))

    # 5. API-VERSION pin (only where a pin file exists)
    if os.path.exists("API-VERSION"):
        pin = open("API-VERSION", encoding="utf-8").read().strip()
        info_ver = None
        for cand in ("openapi.json", "docs/openapi.json"):
            if os.path.exists(cand):
                try:
                    info_ver = json.load(open(cand, encoding="utf-8")).get("info", {}).get("version")
                except Exception:  # noqa: BLE001
                    info_ver = None
                break
        ok = bool(pin) and info_ver is not None and str(info_ver).strip() == pin
        checks.append(check("api-version-pin", ok,
                            f"API-VERSION pin {pin!r} matches openapi info.version"
                            if ok else
                            f"API-VERSION pin {pin!r} != openapi info.version {info_ver!r}"))
    else:
        checks.append(check("api-version-pin", True, "no API-VERSION pin in this repo — skipped"))

    report = {"repo": a.repo, "site_dir": a.site_dir, "checks": checks,
              "pass": all(c["pass"] for c in checks)}
    with open(a.json_out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, separators=(",", ":"))
    for c in checks:
        print(("PASS" if c["pass"] else "FAIL"), c["id"], "-", c["detail"])
    sys.exit(0 if report["pass"] else 1)


if __name__ == "__main__":
    main()
