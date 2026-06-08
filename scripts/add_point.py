#!/usr/bin/env python3
"""
add_point.py — maintain data/metrics.json AND the inline copy embedded in index.html.

The dashboard reads its data from an inline <script id="metrics-data"> block in index.html,
so it renders even when index.html is opened directly as a local file (file://) with no
network/fetch. data/metrics.json stays the editable source of truth; this script keeps the
inline copy in sync with it.

Usage:
    python scripts/add_point.py <series_id> <period> <value>   # add/update a point in BOTH files
    python scripts/add_point.py --sync                         # re-embed data/metrics.json into
                                                               # index.html (run after hand-editing JSON)

Examples:
    python scripts/add_point.py us_handle 2026 205
    python scripts/add_point.py betvision_attach 2025 80
    python scripts/add_point.py --sync

No third-party dependencies — stdlib only. It does NOT change a series' `type`;
set reported / estimate / illustrative by hand in the JSON.
"""

import argparse
import datetime
import json
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METRICS_PATH = os.path.join(REPO_ROOT, "data", "metrics.json")
INDEX_PATH = os.path.join(REPO_ROOT, "index.html")
MARK_OPEN = '<script id="metrics-data" type="application/json">'
MARK_CLOSE = "</script>"


def serialize(data):
    """Pretty JSON, but keep each {period,value} / {label,value} object on a single line."""
    s = json.dumps(data, indent=2, ensure_ascii=False)
    s = re.sub(r'\{\s*"period":\s*("(?:[^"\\]|\\.)*"),\s*"value":\s*([^\s,}]+)\s*\}',
               r'{"period": \1, "value": \2}', s)
    s = re.sub(r'\{\s*"label":\s*("(?:[^"\\]|\\.)*"),\s*"value":\s*([^\s,}]+)\s*\}',
               r'{"label": \1, "value": \2}', s)
    return s


def embed_into_index(json_text):
    """Replace the body of the inline <script id="metrics-data"> block with json_text."""
    if "</script" in json_text.lower():
        sys.exit("error: metrics JSON contains '</script' which would break the inline block.")
    with open(INDEX_PATH, "r", encoding="utf-8") as fh:
        html = fh.read()
    i = html.find(MARK_OPEN)
    if i == -1:
        sys.exit('error: <script id="metrics-data" type="application/json"> not found in index.html')
    body_start = i + len(MARK_OPEN)
    body_end = html.find(MARK_CLOSE, body_start)
    if body_end == -1:
        sys.exit("error: closing </script> for the metrics block not found in index.html")
    new_html = html[:body_start] + "\n" + json_text + "\n" + html[body_end:]
    with open(INDEX_PATH, "w", encoding="utf-8") as fh:
        fh.write(new_html)


def sync():
    """Mirror the current data/metrics.json text into index.html (does not rewrite the JSON)."""
    with open(METRICS_PATH, "r", encoding="utf-8") as fh:
        text = fh.read().rstrip("\n")
    json.loads(text)  # validate before embedding
    embed_into_index(text)
    print("synced: embedded data/metrics.json into <script id=metrics-data> in index.html")


def parse_value(raw):
    try:
        if any(c in raw for c in ".eE"):
            return float(raw)
        return int(raw)
    except ValueError:
        return raw


def add_point(series_id, period, raw_value):
    with open(METRICS_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    series = next((s for s in data.get("series", []) if s.get("id") == series_id), None)
    if series is None:
        ids = ", ".join(sorted(s.get("id", "?") for s in data.get("series", [])))
        sys.exit(f"error: no series with id '{series_id}'.\nknown ids: {ids}")

    value = parse_value(raw_value)
    points = series.setdefault("data", [])
    existing = next((p for p in points if p.get("period") == period), None)
    if existing is not None:
        old = existing.get("value")
        existing["value"] = value
        action = f"updated {series_id}[{period}] {old} -> {value}"
    else:
        points.append({"period": period, "value": value})
        action = f"appended {series_id}[{period}] = {value}"

    if series.get("status") == "needs_data":
        series["status"] = "ok"
        action += "  (status: needs_data -> ok)"

    today = datetime.date.today().isoformat()
    data["updated"] = today

    text = serialize(data)
    with open(METRICS_PATH, "w", encoding="utf-8") as fh:
        fh.write(text + "\n")
    embed_into_index(text)  # keep the inline copy in sync

    print(action)
    print(f'updated "{today}" · {len(points)} point(s) in {series_id} · wrote data/metrics.json + index.html')


def main():
    if len(sys.argv) == 2 and sys.argv[1] in ("--sync", "sync"):
        sync()
        return
    ap = argparse.ArgumentParser(
        description="Add/update one point in data/metrics.json and the inline copy in index.html. "
                    "Run with just --sync to re-embed the JSON after hand-editing it.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("series_id", help="id of the series to edit (e.g. us_handle)")
    ap.add_argument("period", help='period label string (e.g. "2026" or "Q2 2026")')
    ap.add_argument("value", help="numeric value for that period")
    args = ap.parse_args()
    add_point(args.series_id, args.period, args.value)


if __name__ == "__main__":
    main()
