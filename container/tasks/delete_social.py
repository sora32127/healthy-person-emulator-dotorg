"""SNS post deletion task. Deletes posts from Twitter, Bluesky, or Misskey."""

import logging
import os

import tweepy
from atproto import Client as BlueskyClient
from misskey import Misskey

from shared.config import DRY_RUN

logger = logging.getLogger(__name__)


def handle(params: dict) -> dict:
    """params: { platform, provider_post_id }"""
    platform = params["platform"]
    provider_post_id = params["provider_post_id"]

    if DRY_RUN:
        logger.info(f"[DRY RUN] Would delete {platform} post: {provider_post_id}")
        return {"deleted": False, "dry_run": True, "platform": platform}

    if platform == "twitter":
        return _delete_tweet(provider_post_id)
    elif platform == "bluesky":
        return _delete_bluesky(provider_post_id)
    elif platform == "activitypub":
        return _delete_misskey(provider_post_id)
    else:
        raise ValueError(f"Unknown platform: {platform}")


def _delete_tweet(tweet_id: str) -> dict:
    client = tweepy.Client(
        consumer_key=os.environ["TWITTER_CK"],
        consumer_secret=os.environ["TWITTER_CS"],
        access_token=os.environ["TWITTER_AT"],
        access_token_secret=os.environ["TWITTER_ATS"],
    )
    client.delete_tweet(id=tweet_id)
    logger.info(f"Deleted tweet: {tweet_id}")
    return {"deleted": True, "platform": "twitter", "provider_post_id": tweet_id}


def _delete_bluesky(post_uri: str) -> dict:
    user = os.environ["BLUESKY_USER"]
    password = os.environ["BLUESKY_PASSWORD"]

    client = BlueskyClient(base_url="https://bsky.social")
    client.login(user, password)

    # post_uri format: at://did:plc:xxx/app.bsky.feed.post/yyy
    # Extract repo, collection, rkey from URI
    parts = post_uri.replace("at://", "").split("/")
    repo = parts[0]
    collection = parts[1]
    rkey = parts[2]

    client.com.atproto.repo.delete_record(
        data={"repo": repo, "collection": collection, "rkey": rkey}
    )
    logger.info(f"Deleted Bluesky post: {post_uri}")
    return {"deleted": True, "platform": "bluesky", "provider_post_id": post_uri}


def _delete_misskey(note_id: str) -> dict:
    misskey_token = os.environ["MISSKEY_TOKEN"]
    mk = Misskey("https://misskey.io", i=misskey_token)
    mk.notes_delete(note_id)
    logger.info(f"Deleted Misskey note: {note_id}")
    return {"deleted": True, "platform": "activitypub", "provider_post_id": note_id}
