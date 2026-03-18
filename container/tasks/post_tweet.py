"""Twitter posting task. Ported from Lambda PostTweet."""

import logging
import os

import requests
import tweepy

from shared.config import DRY_RUN

logger = logging.getLogger(__name__)

TYPE_PREFIX = {"new": "新規記事", "legendary": "殿堂入り", "random": "ランダム"}


def create_post_text(post_title: str, post_url: str, message_type: str) -> str:
    if message_type not in TYPE_PREFIX:
        raise ValueError(f"Unknown message type: {message_type}")
    return f"[{TYPE_PREFIX[message_type]}] : {post_title} 健常者エミュレータ事例集\n{post_url}"


def handle(params: dict) -> dict:
    """params: { post_title, post_url, og_url, message_type, post_id }"""
    post_title = params["post_title"]
    post_url = params["post_url"]
    og_url = params["og_url"]
    message_type = params["message_type"]

    post_text = create_post_text(post_title, post_url, message_type)

    if DRY_RUN:
        logger.info(f"[DRY RUN] Would tweet: {post_text}")
        return {"tweet_id": "dry-run", "text": post_text}

    ck = os.environ["TWITTER_CK"]
    cs = os.environ["TWITTER_CS"]
    at = os.environ["TWITTER_AT"]
    ats = os.environ["TWITTER_ATS"]

    # Download OG image
    image_data = requests.get(og_url).content
    tmp_path = "/tmp/og_image.jpg"
    with open(tmp_path, "wb") as f:
        f.write(image_data)

    # Upload media via v1 API, create tweet via v2 API
    auth = tweepy.OAuth1UserHandler(
        consumer_key=ck, consumer_secret=cs,
        access_token=at, access_token_secret=ats,
    )
    api = tweepy.API(auth)
    media = api.media_upload(filename=tmp_path)

    client = tweepy.Client(
        consumer_key=ck, consumer_secret=cs,
        access_token=at, access_token_secret=ats,
    )
    tweet = client.create_tweet(text=post_text, media_ids=[media.media_id])
    tweet_id = tweet.data["id"]

    logger.info(f"Tweeted: {post_title} (tweet_id={tweet_id})")
    return {"tweet_id": tweet_id}
