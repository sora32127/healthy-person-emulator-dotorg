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


SITE_URL = "sc-domain:healthy-person-emulator.org"
PROJECT_ID = "healthy-person-emulator"
DATASET_ID = "searchconsole"


def build_search_console_service():
    """ADC を使って Search Console API クライアントを構築する."""
    import google.auth
    from googleapiclient.discovery import build

    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    return build("searchconsole", "v1", credentials=credentials)


def fetch_site_impressions(service, target_date: date) -> list[dict]:
    """指定日のサイトレベル検索データを全行取得する."""
    date_str = target_date.isoformat()
    all_rows = []
    start_row = 0
    page_size = 25000

    while True:
        response = (
            service.searchanalytics()
            .query(
                siteUrl=SITE_URL,
                body={
                    "startDate": date_str,
                    "endDate": date_str,
                    "dimensions": ["query", "country", "device"],
                    "type": "web",
                    "rowLimit": page_size,
                    "startRow": start_row,
                },
            )
            .execute()
        )
        rows = response.get("rows", [])
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        start_row += page_size

    # IMAGE 検索も取得
    start_row = 0
    while True:
        response = (
            service.searchanalytics()
            .query(
                siteUrl=SITE_URL,
                body={
                    "startDate": date_str,
                    "endDate": date_str,
                    "dimensions": ["query", "country", "device"],
                    "type": "image",
                    "rowLimit": page_size,
                    "startRow": start_row,
                },
            )
            .execute()
        )
        rows = response.get("rows", [])
        for row in rows:
            row["_search_type"] = "IMAGE"
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        start_row += page_size

    return all_rows


def fetch_url_impressions(service, target_date: date) -> list[dict]:
    """指定日のURLレベル検索データを全行取得する."""
    date_str = target_date.isoformat()
    all_rows = []

    for search_type in ["web", "image"]:
        start_row = 0
        page_size = 25000
        while True:
            response = (
                service.searchanalytics()
                .query(
                    siteUrl=SITE_URL,
                    body={
                        "startDate": date_str,
                        "endDate": date_str,
                        "dimensions": ["page", "query", "country", "device"],
                        "type": search_type,
                        "rowLimit": page_size,
                        "startRow": start_row,
                    },
                )
                .execute()
            )
            rows = response.get("rows", [])
            for row in rows:
                row["_search_type"] = search_type.upper()
            all_rows.extend(rows)
            if len(rows) < page_size:
                break
            start_row += page_size

    return all_rows


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

    service = build_search_console_service()
    print("Search Console API クライアント初期化完了")

    for i, d in enumerate(date_range(args.start_date, args.end_date), 1):
        site_rows = fetch_site_impressions(service, d)
        url_rows = fetch_url_impressions(service, d)
        print(f"[{i}/{total_days}] {d}: site={len(site_rows)}行, url={len(url_rows)}行")


if __name__ == "__main__":
    main()
