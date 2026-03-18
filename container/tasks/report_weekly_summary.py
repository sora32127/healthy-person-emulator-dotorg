"""Weekly summary report task. Ported from Lambda ReportWeeklySummary."""

import json
import logging
import os

import tweepy
from google.cloud import bigquery
from google.oauth2 import service_account

from shared.config import DRY_RUN

logger = logging.getLogger(__name__)


def get_bq_client() -> bigquery.Client:
    creds_json = json.loads(os.environ["BIGQUERY_CREDENTIALS"])
    credentials = service_account.Credentials.from_service_account_info(creds_json)
    return bigquery.Client(credentials=credentials)


def get_weekly_summary_data(client: bigquery.Client) -> list:
    query = """
        SELECT *
        FROM `healthy-person-emulator.dbt_sora32127.report_weekly_summary`
    """
    rows = client.query(query)
    return [
        {
            "post_id": row["post_id"],
            "post_title": row["post_title"],
            "post_date_jst": row["post_date_jst"].isoformat(),
            "vote_count": row["vote_count"],
        }
        for row in rows
    ]


def create_tweet_text(weekly_data: list) -> str:
    tweet_text = "【今週の人気投稿】\n"
    for i in range(min(3, len(weekly_data))):
        post = weekly_data[i]
        post_url = f"https://healthy-person-emulator.org/archives/{post['post_id']}"
        tweet_text += f"\n{i + 1} : {post['post_title']} \n{post_url}\n"
    # Last link for Twitter OG preview
    first_post_url = f"https://healthy-person-emulator.org/archives/{weekly_data[0]['post_id']}"
    tweet_text += f"\n{first_post_url}"
    return tweet_text


def handle(params: dict) -> dict:
    bq_client = get_bq_client()
    weekly_data = get_weekly_summary_data(bq_client)

    if not weekly_data:
        return {"posted": False, "message": "No weekly summary data"}

    tweet_text = create_tweet_text(weekly_data)

    if DRY_RUN:
        logger.info(f"[DRY RUN] Would tweet weekly summary:\n{tweet_text}")
        return {"posted": False, "dry_run": True, "text": tweet_text}

    ck = os.environ["TWITTER_CK"]
    cs = os.environ["TWITTER_CS"]
    at = os.environ["TWITTER_AT"]
    ats = os.environ["TWITTER_ATS"]

    client = tweepy.Client(
        consumer_key=ck, consumer_secret=cs,
        access_token=at, access_token_secret=ats,
    )
    client.create_tweet(text=tweet_text)

    logger.info("Weekly summary tweeted successfully")
    return {"posted": True, "text": tweet_text}
