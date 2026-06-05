#!/usr/bin/env python3
"""
add_point.py — append (or update) one data point in data/metrics.json.

Usage:
    python scripts/add_point.py <series_id> <period> <value>

Examples:
    python scripts/add_point.py us_handle 2026 205
    python scripts/add_point.py geni_revenue "2026E PF" 1100
    python scripts/add_point.py rev_over_rights_cost "Q2 2026" 2.31

What it does:
    - finds the series by id in data/metrics.json
    - appends {"period": <period>, "value": <value>}  (or updates that period if it already exists)
    - flips "status": "needs_data" -> "ok" if the series was empty
    - bumps the top-level "updated" field to today's date

No third-party dependencies — stdlib json/argparse/datetime only.
It does NOT change a series' `type`; set reported/estimate/illustrative by hand in the JSON.
"""

import argparse
import datetime
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METRICS_PATH = os.path.join(REPO_ROOT, "data", "metrics.json")


def parse_value(raw):
    """Numbers become int/float; anything non-numeric stays a string."""
    try:
        if any(c in raw for c in ".eE"):
            return float(raw)
        return int(raw)
    except ValueError:
        return raw


def main():
    ap = argparse.ArgumentParser(
        description="Append or update one point in data/metrics.json.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("series_id", help="id of the series to edit (e.g. us_handle)")
    ap.add_argument("period", help='period label string (e.g. "2026" or "Q2 2026")')
    ap.add_argument("value", help="numeric value for that period")
    args = ap.parse_args()

    with open(METRICS_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    series = next((s for s in data.get("series", []) if s.get("id") == args.series_id), None)
    if series is None:
        ids = ", ".join(sorted(s.get("id", "?") for s in data.get("series", [])))
        sys.exit(f"error: no series with id '{args.series_id}'.\nknown ids: {ids}")

    value = parse_value(args.value)
    points = series.setdefault("data", [])

    existing = next((p for p in points if p.get("period") == args.period), None)
    if existing is not None:
        old = existing.get("value")
        existing["value"] = value
        action = f"updated {args.series_id}[{args.period}] {old} -> {value}"
    else:
        points.append({"period": args.period, "value": value})
        action = f"appended {args.series_id}[{args.period}] = {value}"

    if series.get("status") == "needs_data":
        series["status"] = "ok"
        action += "  (status: needs_data -> ok)"

    today = datetime.date.today().isoformat()
    data["updated"] = today

    with open(METRICS_PATH, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print(action)
    print(f'updated "{today}" · {len(points)} point(s) now in {args.series_id}')


if __name__ == "__main__":
    main()
