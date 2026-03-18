"""Misskey (ActivityPub) posting task. Ported from Lambda PostActivityPub."""

import logging
import os

import httpx
from misskey import Misskey

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
        logger.info(f"[DRY RUN] Would post to Misskey: {post_text}")
        return {"misskey_note_id": "dry-run", "text": post_text}

    misskey_token = os.environ["MISSKEY_TOKEN"]
    mk = Misskey("https://misskey.io", i=misskey_token)

    # Download and upload image
    image_data = httpx.get(og_url).content
    tmp_path = "/tmp/og_image.jpg"
    with open(tmp_path, "wb") as f:
        f.write(image_data)

    with open(tmp_path, "rb") as f:
        drive_file = mk.drive_files_create(f)
    uploaded_file_id = drive_file["id"]

    # Post note
    note = mk.notes_create(text=post_text, file_ids=[uploaded_file_id])
    note_id = note["createdNote"]["id"]

    logger.info(f"Posted to Misskey: {post_title} (note_id={note_id})")
    return {"misskey_note_id": note_id}
