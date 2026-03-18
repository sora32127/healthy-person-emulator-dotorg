"""Bluesky posting task. Ported from Lambda PostBluesky."""

import logging
import os

import requests
from atproto import Client, models

from shared.config import DRY_RUN

logger = logging.getLogger(__name__)

TYPE_PREFIX = {"new": "新規記事", "legendary": "殿堂入り", "random": "ランダム"}


def create_post_text(post_title: str, message_type: str) -> str:
    if message_type not in TYPE_PREFIX:
        raise ValueError(f"Unknown message type: {message_type}")
    return f"【{TYPE_PREFIX[message_type]}】 : {post_title}"


def handle(params: dict) -> dict:
    """params: { post_title, post_url, og_url, message_type, post_id }"""
    post_title = params["post_title"]
    post_url = params["post_url"]
    og_url = params["og_url"]
    message_type = params["message_type"]

    post_text = create_post_text(post_title, message_type)

    if DRY_RUN:
        logger.info(f"[DRY RUN] Would post to Bluesky: {post_text}")
        return {"bluesky_post_uri": "dry-run", "text": post_text}

    user = os.environ["BLUESKY_USER"]
    password = os.environ["BLUESKY_PASSWORD"]

    image_data = requests.get(og_url).content

    client = Client(base_url="https://bsky.social")
    client.login(user, password)

    thumbnail = client.upload_blob(image_data)

    embed = models.AppBskyEmbedExternal.Main(
        external=models.AppBskyEmbedExternal.External(
            title=post_title,
            uri=post_url,
            thumb=thumbnail.blob,
            description="",
        )
    )

    post = client.send_post(text=post_text, embed=embed)
    bluesky_post_uri = post.uri

    logger.info(f"Posted to Bluesky: {post_title} (uri={bluesky_post_uri})")
    return {"bluesky_post_uri": bluesky_post_uri}
