"""OGP image generation task. Ported from Lambda CreateOGImage."""

import io
import json
import logging
import os
import re
import textwrap
import urllib.request
from typing import Dict, Final, List

from PIL import Image, ImageDraw, ImageFont

from shared.config import API_BASE_URL, R2_BUCKET, get_r2_client

logger = logging.getLogger(__name__)

FONT_FILE_PATH: Final[str] = os.path.join(os.path.dirname(__file__), "..", "fonts", "NotoSansJP-Medium.ttf")

IMAGE_WIDTH: Final[int] = 1200
IMAGE_HEIGHT: Final[int] = 630
KEY_COLUMN_WIDTH: Final[int] = 270
CONTENT_COLUMN_WIDTH: Final[int] = IMAGE_WIDTH - KEY_COLUMN_WIDTH
FONT_SIZE: Final[int] = 30
WIDTH_MARGIN: Final[int] = 20
HEIGHT_MARGIN: Final[int] = 20
AVAILABLE_HEIGHT: Final[int] = IMAGE_HEIGHT - (2 * HEIGHT_MARGIN)
UPPER_PADDING_RATIO: Final[float] = 0.65


def poll_for_new_posts(api_key: str) -> List[Dict]:
    from bs4 import BeautifulSoup

    req = urllib.request.Request(
        f"{API_BASE_URL}/api/internal/posts-for-ogp",
        headers={"X-API-Key": api_key, "User-Agent": "HPE-Automation-Container/1.0"},
    )
    with urllib.request.urlopen(req) as res:
        result = json.loads(res.read())

    data = []
    for post in result["posts"]:
        soup = BeautifulSoup(post["postContent"], "html.parser")
        table_data_raw = soup.find("table").find_all("td")
        table_data = {
            table_data_raw[2 * i].text: table_data_raw[2 * i + 1].text
            for i in range(len(table_data_raw) // 2)
        }
        data.append({
            "post_id": post["postId"],
            "post_title": post["postTitle"],
            "post_content": table_data,
        })
    return data


def generate_image(table_data: Dict[str, str]) -> bytes:
    font = ImageFont.truetype(FONT_FILE_PATH, FONT_SIZE)
    im = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT), (245, 245, 245))
    draw = ImageDraw.Draw(im)

    def get_key_weight(key: str) -> int:
        return 2 if key in ["Then(どうした)", "Why(なぜ)"] else 1

    total_weight = sum(get_key_weight(key) for key in table_data.keys())
    unit_height = AVAILABLE_HEIGHT // total_weight

    draw.line(
        [(KEY_COLUMN_WIDTH, HEIGHT_MARGIN), (KEY_COLUMN_WIDTH, IMAGE_HEIGHT - HEIGHT_MARGIN)],
        fill=(0, 0, 0), width=1,
    )

    current_y = HEIGHT_MARGIN
    for key in list(table_data.keys())[:-1]:
        current_y += unit_height * get_key_weight(key)
        draw.line(
            [(WIDTH_MARGIN, current_y), (IMAGE_WIDTH - WIDTH_MARGIN, current_y)],
            fill=(0, 0, 0), width=1,
        )

    current_y = HEIGHT_MARGIN
    for key, content in table_data.items():
        line_height = unit_height * get_key_weight(key)
        is_double_height = get_key_weight(key) == 2

        key_bbox = draw.textbbox((0, 0), key, font=font)
        key_width = key_bbox[2] - key_bbox[0]
        key_height = key_bbox[3] - key_bbox[1]
        key_padding = (line_height - key_height) / 2
        key_x = KEY_COLUMN_WIDTH - WIDTH_MARGIN - key_width
        key_y = current_y + key_padding * UPPER_PADDING_RATIO

        draw.text((key_x, key_y), key, font=font, fill=(0, 0, 0))

        content_width = (CONTENT_COLUMN_WIDTH - WIDTH_MARGIN * 2) // FONT_SIZE - 1
        content_lines = textwrap.wrap(content, width=content_width)

        if content_lines:
            if is_double_height:
                if len(content_lines) > 2:
                    content_text = content_lines[0] + "\n" + content_lines[1] + "..."
                elif len(content_lines) == 2:
                    content_text = content_lines[0] + "\n" + content_lines[1]
                else:
                    content_text = content_lines[0]
                content_bbox = draw.multiline_textbbox((0, 0), content_text, font=font)
            else:
                content_text = content_lines[0] + ("..." if len(content_lines) > 1 else "")
                content_bbox = draw.textbbox((0, 0), content_text, font=font)

            content_height = content_bbox[3] - content_bbox[1]
            content_padding = (line_height - content_height) / 2
            content_y = current_y + content_padding * UPPER_PADDING_RATIO

            draw.text(
                (KEY_COLUMN_WIDTH + WIDTH_MARGIN, content_y),
                content_text, font=font, fill=(0, 0, 0),
            )

        current_y += line_height

    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def upload_to_r2(image_bytes: bytes, post_id: int) -> str:
    """Try R2 upload if credentials available, otherwise skip (Worker will handle it)."""
    try:
        s3 = get_r2_client()
        key = f"ogp/{post_id}.jpg"
        s3.put_object(
            Bucket=R2_BUCKET,
            Key=key,
            Body=image_bytes,
            ContentType="image/jpeg",
        )
        ogp_base_url = os.environ.get("OGP_BASE_URL", "https://static.healthy-person-emulator.org")
        return f"{ogp_base_url}/{key}"
    except (KeyError, Exception) as e:
        logger.warning(f"R2 upload skipped (will be handled by Worker): {e}")
        return ""


def update_ogp_url(post_id: int, ogp_url: str, api_key: str) -> None:
    body = json.dumps({"postId": post_id, "ogpImageUrl": ogp_url}).encode()
    req = urllib.request.Request(
        f"{API_BASE_URL}/api/internal/update-ogp",
        data=body,
        headers={"X-API-Key": api_key, "Content-Type": "application/json", "User-Agent": "HPE-Automation-Container/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        res.read()


def handle(params: dict) -> dict:
    """Called from main.py. params: { api_key: str }"""
    api_key = params["api_key"]
    posts = poll_for_new_posts(api_key)

    if not posts:
        return {"processed": 0, "message": "No posts to process"}

    results = []
    for post in posts:
        post_id = post["post_id"]
        post_title = post["post_title"]

        if re.match(r"^.*プログラムテスト.*$", post_title):
            logger.info(f"Skipping test post: {post_id}")
            continue

        image_bytes = generate_image(post["post_content"])
        ogp_url = upload_to_r2(image_bytes, post_id)

        # If R2 upload was skipped, return base64 image for Worker to handle
        import base64
        image_b64 = base64.b64encode(image_bytes).decode() if not ogp_url else None

        if ogp_url:
            update_ogp_url(post_id, ogp_url, api_key)

        results.append({
            "post_id": post_id,
            "post_title": post_title,
            "ogp_url": ogp_url,
            "image_b64": image_b64,
            "post_url": f"https://healthy-person-emulator.org/archives/{post_id}",
        })
        logger.info(f"OGP created for post {post_id}")

    return {"processed": len(results), "posts": results}
