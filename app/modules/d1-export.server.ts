/**
 * D1 → R2 NDJSON export for BigQuery ETL.
 * Exports all tables from D1 to R2 as NDJSON files + manifest.json.
 */

import type { CloudflareEnv } from "../types/env";

const TABLES = [
  "dim_tags",
  "dim_posts",
  "dim_comments",
  "dim_stop_words",
  "dim_users",
  "rel_post_tags",
  "fct_post_vote_history",
  "fct_comment_vote_history",
  "fct_post_edit_history",
  "fct_aicompletion_suggestion_history",
  "fct_aicompletion_commit_history",
  "fct_user_bookmark_activity",
  "now_editing_pages",
  "social_post_jobs",
];

const ETL_PREFIX = "etl";
const BATCH_SIZE = 1000;

export async function exportD1ToR2(env: CloudflareEnv): Promise<{ manifest_key: string }> {
  const manifest: { tables: Array<{ name: string; key: string; row_count: number }> } = {
    tables: [],
  };

  for (const table of TABLES) {
    let allRows: Record<string, unknown>[] = [];
    let offset = 0;

    // Paginate through table
    while (true) {
      const result = await env.DB.prepare(
        `SELECT * FROM ${table} LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
      ).all();

      if (!result.results || result.results.length === 0) break;
      allRows = allRows.concat(result.results);
      offset += BATCH_SIZE;

      if (result.results.length < BATCH_SIZE) break;
    }

    // Write NDJSON to R2
    const ndjson = allRows.map((row) => JSON.stringify(row)).join("\n");
    const key = `${ETL_PREFIX}/${table}.ndjson`;

    await env.STATIC_BUCKET.put(key, ndjson, {
      httpMetadata: { contentType: "application/x-ndjson" },
    });

    manifest.tables.push({ name: table, key, row_count: allRows.length });
    console.log(`[d1-export] ${table}: ${allRows.length} rows`);
  }

  // Write manifest
  const manifestKey = `${ETL_PREFIX}/manifest.json`;
  await env.STATIC_BUCKET.put(manifestKey, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json" },
  });

  console.log(`[d1-export] Manifest written: ${manifest.tables.length} tables`);
  return { manifest_key: manifestKey };
}
