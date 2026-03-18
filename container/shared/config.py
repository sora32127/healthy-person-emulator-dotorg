"""Shared configuration and utilities for all tasks."""

import os
import logging

logging.basicConfig(level=logging.INFO, format="[%(name)s] %(levelname)s: %(message)s")

API_BASE_URL = os.environ.get("API_BASE_URL", "https://healthy-person-emulator.org")
DRY_RUN = os.environ.get("AUTOMATION_DRY_RUN", "false").lower() == "true"


def get_r2_client():
    """Create an S3-compatible client for Cloudflare R2."""
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )


R2_BUCKET = "healthy-person-emulator-static"
