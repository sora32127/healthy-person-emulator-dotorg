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


def transform_site_impressions(rows: list[dict], target_date: date) -> list[dict]:
    """API レスポンスを searchdata_site_impression スキーマに変換する."""
    date_str = target_date.isoformat()
    result = []
    for row in rows:
        keys = row["keys"]  # [query, country, device]
        impressions = int(row["impressions"])
        clicks = int(row["clicks"])
        position = row["position"]
        search_type = row.get("_search_type", "WEB")

        result.append({
            "data_date": date_str,
            "site_url": SITE_URL,
            "query": keys[0],
            "is_anonymized_query": False,
            "country": keys[1],
            "search_type": search_type,
            "device": keys[2].upper(),
            "impressions": impressions,
            "clicks": clicks,
            "sum_top_position": round(position * impressions),
        })
    return result


# url_impression の is_* カラム (全て False 固定)
URL_IMPRESSION_BOOL_COLUMNS = [
    "is_anonymized_discover",
    "is_amp_top_stories",
    "is_amp_blue_link",
    "is_job_listing",
    "is_job_details",
    "is_tpf_qa",
    "is_tpf_faq",
    "is_tpf_howto",
    "is_weblite",
    "is_action",
    "is_events_listing",
    "is_events_details",
    "is_forums",
    "is_search_appearance_android_app",
    "is_amp_story",
    "is_amp_image_result",
    "is_video",
    "is_organic_shopping",
    "is_review_snippet",
    "is_special_announcement",
    "is_recipe_feature",
    "is_recipe_rich_snippet",
    "is_subscribed_content",
    "is_page_experience",
    "is_practice_problems",
    "is_math_solvers",
    "is_translated_result",
    "is_edu_q_and_a",
    "is_product_snippets",
    "is_merchant_listings",
    "is_learning_videos",
]


def transform_url_impressions(rows: list[dict], target_date: date) -> list[dict]:
    """API レスポンスを searchdata_url_impression スキーマに変換する."""
    date_str = target_date.isoformat()
    bool_defaults = {col: False for col in URL_IMPRESSION_BOOL_COLUMNS}
    result = []
    for row in rows:
        keys = row["keys"]  # [page, query, country, device]
        impressions = int(row["impressions"])
        clicks = int(row["clicks"])
        position = row["position"]
        search_type = row.get("_search_type", "WEB")

        record = {
            "data_date": date_str,
            "site_url": SITE_URL,
            "url": keys[0],
            "query": keys[1],
            "is_anonymized_query": False,
            "country": keys[2],
            "search_type": search_type,
            "device": keys[3].upper(),
            "impressions": impressions,
            "clicks": clicks,
            "sum_position": round(position * impressions),
            **bool_defaults,
        }
        result.append(record)
    return result


def get_bq_client():
    """ADC を使って BigQuery クライアントを構築する."""
    from google.cloud import bigquery
    return bigquery.Client(project=PROJECT_ID)


def load_to_bigquery(client, table_id: str, rows: list[dict]):
    """行データを BigQuery テーブルに挿入する."""
    if not rows:
        return
    full_table_id = f"{PROJECT_ID}.{DATASET_ID}.{table_id}"
    errors = client.insert_rows_json(full_table_id, rows)
    if errors:
        raise RuntimeError(f"BigQuery insert errors for {full_table_id}: {errors}")


def main():
    args = parse_args()
    print(f"期間: {args.start_date} 〜 {args.end_date}")
    total_days = (args.end_date - args.start_date).days + 1
    print(f"対象日数: {total_days}")

    if args.dry_run:
        print("[DRY RUN] BigQuery への書き込みはスキップされます")

    service = build_search_console_service()
    print("Search Console API クライアント初期化完了")

    bq_client = None
    if not args.dry_run:
        bq_client = get_bq_client()
        print("BigQuery クライアント初期化完了")

    total_site = 0
    total_url = 0

    for i, d in enumerate(date_range(args.start_date, args.end_date), 1):
        site_rows = fetch_site_impressions(service, d)
        url_rows = fetch_url_impressions(service, d)

        site_records = transform_site_impressions(site_rows, d)
        url_records = transform_url_impressions(url_rows, d)

        if not args.dry_run:
            load_to_bigquery(bq_client, "searchdata_site_impression", site_records)
            load_to_bigquery(bq_client, "searchdata_url_impression", url_records)

        total_site += len(site_records)
        total_url += len(url_records)
        status = "[DRY RUN] " if args.dry_run else ""
        print(
            f"{status}[{i}/{total_days}] {d}: "
            f"site={len(site_records)}行, url={len(url_records)}行"
        )

    print(f"\n完了: site_impression={total_site}行, url_impression={total_url}行")


if __name__ == "__main__":
    main()
