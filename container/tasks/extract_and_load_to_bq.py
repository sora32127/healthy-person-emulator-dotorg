"""D1 → BigQuery ETL task. Ported from Lambda ExtractAndLoadToBQ.

The original Lambda pulled from PostgreSQL. The new version reads NDJSON files
from R2 (exported by the Worker) and loads them into BigQuery using dlt.
"""

import json
import logging
import os
from time import time

import dlt

from shared.config import get_r2_client, R2_BUCKET

logger = logging.getLogger(__name__)

BQ_DATASET = "HPE_RAW"


def handle(params: dict) -> dict:
    """params: { manifest_key: str } — R2 key of the manifest.json written by Worker."""
    manifest_key = params.get("manifest_key", "etl/manifest.json")

    s3 = get_r2_client()

    # Read manifest
    manifest_obj = s3.get_object(Bucket=R2_BUCKET, Key=manifest_key)
    manifest = json.loads(manifest_obj["Body"].read())
    tables = manifest["tables"]

    bq_creds = json.loads(os.environ["BIGQUERY_CREDENTIALS"])

    results = []
    for table_info in tables:
        table_name = table_info["name"]
        ndjson_key = table_info["key"]
        row_count = table_info.get("row_count", "?")

        try:
            start = time()
            obj = s3.get_object(Bucket=R2_BUCKET, Key=ndjson_key)
            raw = obj["Body"].read().decode()
            rows = [json.loads(line) for line in raw.strip().split("\n") if line.strip()]

            pipeline = dlt.pipeline(
                pipeline_name=f"extract_{table_name}",
                destination=dlt.destinations.bigquery(credentials=bq_creds),
                dataset_name=BQ_DATASET,
            )
            pipeline.run(rows, table_name=table_name, write_disposition="replace")

            elapsed = time() - start
            logger.info(f"Table {table_name}: {len(rows)} rows in {elapsed:.2f}s")
            results.append({"table": table_name, "rows": len(rows), "elapsed_sec": round(elapsed, 2)})
        except Exception as e:
            logger.error(f"Failed to process {table_name}: {e}")
            results.append({"table": table_name, "error": str(e)})

    return {"tables_processed": len(results), "results": results}
