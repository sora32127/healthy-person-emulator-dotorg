#!/usr/bin/env python3
"""Search Console 過去データを BigQuery にバックフィルする使い捨てスクリプト."""

import argparse
import sys
from datetime import date, timedelta


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search Console API から過去データを取得し BigQuery にロードする"
    )
    parser.add_argument(
        "--start-date",
        type=date.fromisoformat,
        required=True,
        help="開始日 (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--end-date",
        type=date.fromisoformat,
        required=True,
        help="終了日 (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="BigQuery への書き込みをスキップし、取得データの件数のみ表示する",
    )
    return parser.parse_args()


def date_range(start: date, end: date):
    """start から end まで（両端含む）の日付を1日ずつ返すジェネレータ."""
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def main():
    args = parse_args()
    print(f"期間: {args.start_date} 〜 {args.end_date}")
    total_days = (args.end_date - args.start_date).days + 1
    print(f"対象日数: {total_days}")

    if args.dry_run:
        print("[DRY RUN] BigQuery への書き込みはスキップされます")

    for i, d in enumerate(date_range(args.start_date, args.end_date), 1):
        print(f"[{i}/{total_days}] {d} ... (未実装)")


if __name__ == "__main__":
    main()
