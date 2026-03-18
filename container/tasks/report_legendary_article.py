"""Legendary article report task. Ported from Lambda ReportLegendaryArticle."""

import json
import logging
import os
import urllib.request

import tweepy
from google.cloud import bigquery
from google.oauth2 import service_account

from shared.config import API_BASE_URL, DRY_RUN

logger = logging.getLogger(__name__)


def get_bq_client() -> bigquery.Client:
    creds_json = json.loads(os.environ["BIGQUERY_CREDENTIALS"])
    credentials = service_account.Credentials.from_service_account_info(creds_json)
    return bigquery.Client(credentials=credentials)


def get_legendary_article_data(client: bigquery.Client) -> list:
    query = """
        SELECT *
        FROM `healthy-person-emulator.dbt_sora32127.report_new_legend_posts`
    """
    rows = client.query(query)
    return [
        {
            "post_id": row["post_id"],
            "post_title": row["post_title"],
            "post_url": f"https://healthy-person-emulator.org/archives/{row['post_id']}",
        }
        for row in rows
    ]


def update_tags_via_api(articles: list, api_key: str) -> None:
    for article in articles:
        body = json.dumps({"postId": article["post_id"], "tagId": 575}).encode()
        req = urllib.request.Request(
            f"{API_BASE_URL}/api/internal/add-tag-to-post",
            data=body,
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
                "User-Agent": "HPE-Automation-Container/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req) as res:
            res.read()


def post_tweets(articles: list) -> None:
    ck = os.environ["TWITTER_CK"]
    cs = os.environ["TWITTER_CS"]
    at = os.environ["TWITTER_AT"]
    ats = os.environ["TWITTER_ATS"]

    client = tweepy.Client(
        consumer_key=ck, consumer_secret=cs,
        access_token=at, access_token_secret=ats,
    )
    for article in articles:
        text = f"[殿堂入り] : {article['post_title']} 健常者エミュレータ事例集 \n{article['post_url']}"
        client.create_tweet(text=text)
        logger.info(f"Tweeted legendary: {article['post_title']}")


def handle(params: dict) -> dict:
    """params: { api_key: str }"""
    api_key = params["api_key"]

    bq_client = get_bq_client()
    articles = get_legendary_article_data(bq_client)

    if not articles:
        return {"processed": 0, "message": "No new legendary articles"}

    update_tags_via_api(articles, api_key)

    if DRY_RUN:
        logger.info(f"[DRY RUN] Would tweet {len(articles)} legendary articles")
        return {"processed": len(articles), "dry_run": True, "articles": articles}

    post_tweets(articles)
    return {"processed": len(articles), "articles": articles}
