/**
 * Automation flow control — OGP generation, SNS posting, job management.
 * Orchestrates Container calls, D1 state management, and Queue messaging.
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { socialPostJobs, dimPosts } from '../drizzle/schema';
import { nowUTC } from '../drizzle/utils';
import type { CloudflareEnv } from '../types/env';

import { postToSocial } from './social/post.server';
import { PLATFORMS } from './social/types';
import type { Platform } from './social/types';
import { PROGRAM_TEST_PATTERN, ensureResvgWasm, generateOgpPng, parseTable } from './ogp.server';

interface QueueMessage {
  type: 'social_post';
  schema_version: number;
  payload: {
    job_id: string;
    post_id: number;
    platform: Platform;
    post_title: string;
    post_url: string;
    og_url: string;
    message_type: string;
  };
}

// ─── OGP + Social Post flow ─────────────────────────────────

interface ProcessedPost {
  post_id: number;
  post_title: string;
  post_url: string;
  ogp_url: string;
}

/**
 * Called by Cron every 30 minutes.
 * 1. Generate OGP images for new posts in-Worker (SVG → resvg-wasm → PNG → R2)
 * 2. For each processed post, create social_post_jobs and enqueue
 */
export interface OgpAndSocialPostResult {
  skipped: boolean;
  reason?: string;
  postsFound: number;
  jobsEnqueued: number;
}

export interface OgpDeps {
  fontBytes: Uint8Array;
  resvgWasm: WebAssembly.Module;
}

export async function handleOgpAndSocialPost(
  env: CloudflareEnv,
  deps: OgpDeps,
): Promise<OgpAndSocialPostResult> {
  if (env.ENQUEUE_ENABLED !== 'true') {
    console.log('[automation] ENQUEUE_ENABLED is not true, skipping');
    return { skipped: true, reason: 'ENQUEUE_ENABLED is not true', postsFound: 0, jobsEnqueued: 0 };
  }

  const db = drizzle(env.DB);
  await ensureResvgWasm(deps.resvgWasm);

  // Step 1: Pull candidate posts (5W1H+Then content waiting for SNS share)
  const candidates = await db
    .select({
      postId: dimPosts.postId,
      postTitle: dimPosts.postTitle,
      postContent: dimPosts.postContent,
    })
    .from(dimPosts)
    .where(and(eq(dimPosts.isSnsShared, false), eq(dimPosts.isWelcomed, true)))
    .orderBy(desc(dimPosts.postId))
    .limit(5);

  // Step 2: Generate OGP per post, upload to R2, update ogpImageUrl in D1
  const posts: ProcessedPost[] = [];
  for (const c of candidates) {
    if (PROGRAM_TEST_PATTERN.test(c.postTitle)) {
      console.log(`[automation] Skipping test post: ${c.postId}`);
      continue;
    }
    try {
      const table = parseTable(c.postContent);
      if (Object.keys(table).length === 0) {
        console.warn(`[automation] post ${c.postId}: no parseable table, skipping`);
        continue;
      }
      const png = generateOgpPng({ table, fontBytes: deps.fontBytes });
      const key = `ogp/${c.postId}.png`;
      await env.STATIC_BUCKET.put(key, png, {
        httpMetadata: { contentType: 'image/png' },
      });
      const ogpUrl = `https://static.healthy-person-emulator.org/${key}`;
      await db.update(dimPosts).set({ ogpImageUrl: ogpUrl }).where(eq(dimPosts.postId, c.postId));
      posts.push({
        post_id: c.postId,
        post_title: c.postTitle,
        post_url: `https://healthy-person-emulator.org/archives/${c.postId}`,
        ogp_url: ogpUrl,
      });
      console.log(`[automation] OGP generated for post ${c.postId}`);
    } catch (err) {
      console.error(`[automation] OGP failed for post ${c.postId}:`, err);
    }
  }

  if (posts.length === 0) {
    return { skipped: false, postsFound: 0, jobsEnqueued: 0 };
  }

  // Step 3: For each post, create jobs and enqueue
  let jobsEnqueued = 0;
  const now = nowUTC();
  for (const post of posts) {
    for (const platform of PLATFORMS) {
      const jobId = `${post.post_id}_${platform}`;

      // Upsert: skip if job already exists
      const existing = await db
        .select({ id: socialPostJobs.id })
        .from(socialPostJobs)
        .where(eq(socialPostJobs.id, jobId))
        .limit(1);

      if (existing.length > 0) {
        console.log(`[automation] Job ${jobId} already exists, skipping`);
        continue;
      }

      await db.insert(socialPostJobs).values({
        id: jobId,
        postId: post.post_id,
        platform,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      await enqueueAndMarkQueued(env, db, jobId, {
        post_id: post.post_id,
        platform,
        post_title: post.post_title,
        post_url: post.post_url,
        og_url: post.ogp_url,
        message_type: 'new',
      });
      jobsEnqueued++;
    }
  }

  return { skipped: false, postsFound: posts.length, jobsEnqueued };
}

/**
 * Atomically transition pending → queued and send to Queue.
 * CAS update ensures no double-enqueue.
 */
async function enqueueAndMarkQueued(
  env: CloudflareEnv,
  db: ReturnType<typeof drizzle>,
  jobId: string,
  payload: QueueMessage['payload'] extends infer T ? Omit<T, 'job_id'> : never,
): Promise<boolean> {
  const now = nowUTC();

  // CAS: only update if status is still pending
  const result = await db
    .update(socialPostJobs)
    .set({ status: 'queued', updatedAt: now })
    .where(and(eq(socialPostJobs.id, jobId), eq(socialPostJobs.status, 'pending')));

  // Check if update affected any rows
  if (!result.meta.changed_db) {
    console.log(`[automation] Job ${jobId} was not pending, skipping enqueue`);
    return false;
  }

  const message: QueueMessage = {
    type: 'social_post',
    schema_version: 1,
    payload: { ...payload, job_id: jobId },
  };

  await env.SOCIAL_POST_QUEUE.send(message);
  console.log(`[automation] Enqueued job ${jobId}`);
  return true;
}

// ─── Queue consumer ─────────────────────────────────────────

/**
 * Called by Queue consumer for each social_post message.
 * Implements idempotency check → claim → container call → update.
 */
export async function handleSocialPostConsumer(
  env: CloudflareEnv,
  payload: QueueMessage['payload'],
): Promise<{ action: 'sent' | 'skipped' | 'failed' | 'unknown' }> {
  if (env.SEND_ENABLED !== 'true') {
    console.log(`[automation] SEND_ENABLED is not true, keeping job ${payload.job_id} as queued`);
    return { action: 'skipped' };
  }

  const db = drizzle(env.DB);
  const now = nowUTC();

  // Check current status — skip if already completed or being processed
  const [job] = await db
    .select()
    .from(socialPostJobs)
    .where(eq(socialPostJobs.id, payload.job_id))
    .limit(1);

  if (!job) {
    console.warn(`[automation] Job ${payload.job_id} not found in DB`);
    return { action: 'skipped' };
  }

  if (job.status === 'sent' || job.status === 'failed') {
    console.log(`[automation] Job ${payload.job_id} already ${job.status}, skipping`);
    return { action: 'skipped' };
  }

  if (job.status === 'sending') {
    console.log(`[automation] Job ${payload.job_id} is already being processed, skipping`);
    return { action: 'skipped' };
  }

  // CAS: claim the job (queued → sending)
  const claimResult = await db
    .update(socialPostJobs)
    .set({
      status: 'sending',
      claimedAt: now,
      attemptCount: sql`${socialPostJobs.attemptCount} + 1`,
      updatedAt: now,
    })
    .where(and(eq(socialPostJobs.id, payload.job_id), eq(socialPostJobs.status, 'queued')));

  if (!claimResult.meta.changed_db) {
    console.log(`[automation] Failed to claim job ${payload.job_id} (not in queued status)`);
    return { action: 'skipped' };
  }

  // Call container to post
  try {
    const result = await postToSocial(env, {
      platform: payload.platform as Platform,
      postTitle: payload.post_title,
      postUrl: payload.post_url,
      ogUrl: payload.og_url,
      messageType: payload.message_type as 'new' | 'legendary' | 'random',
    });

    const providerPostId = result.providerPostId;

    // Mark as sent
    await db
      .update(socialPostJobs)
      .set({
        status: 'sent',
        providerPostId,
        updatedAt: nowUTC(),
      })
      .where(eq(socialPostJobs.id, payload.job_id));

    // Also update dim_posts with the provider post ID
    if (providerPostId) {
      await updateDimPostsSocialId(db, payload.post_id, payload.platform, providerPostId);
    }

    console.log(
      `[automation] Job ${payload.job_id} sent successfully (provider_id=${providerPostId})`,
    );
    return { action: 'sent' };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorType = classifyError(err);

    if (errorType === 'terminal') {
      await db
        .update(socialPostJobs)
        .set({ status: 'failed', lastError: errorMessage, updatedAt: nowUTC() })
        .where(eq(socialPostJobs.id, payload.job_id));
      console.error(`[automation] Job ${payload.job_id} permanently failed: ${errorMessage}`);
      return { action: 'failed' };
    }

    if (errorType === 'retryable') {
      // Back to queued for Queue retry
      await db
        .update(socialPostJobs)
        .set({ status: 'queued', lastError: errorMessage, updatedAt: nowUTC() })
        .where(eq(socialPostJobs.id, payload.job_id));
      console.warn(`[automation] Job ${payload.job_id} retryable error: ${errorMessage}`);
      throw err; // Let Queue retry
    }

    // ambiguous — mark as unknown
    await db
      .update(socialPostJobs)
      .set({ status: 'unknown', lastError: errorMessage, updatedAt: nowUTC() })
      .where(eq(socialPostJobs.id, payload.job_id));
    console.error(`[automation] Job ${payload.job_id} ambiguous error: ${errorMessage}`);
    return { action: 'unknown' };
  }
}

// ─── Recovery ───────────────────────────────────────────────

/**
 * Called by Cron to recover stale jobs.
 * Jobs stuck in "queued" for >10 min → reset to "pending" and re-enqueue.
 */
export interface RecoverStaleJobsResult {
  recovered: number;
}

export async function recoverStaleJobs(env: CloudflareEnv): Promise<RecoverStaleJobsResult> {
  if (env.ENQUEUE_ENABLED !== 'true') return { recovered: 0 };

  const db = drizzle(env.DB);

  // Find pending or stale queued jobs that need (re-)enqueue
  const jobsToRecover = await db
    .select()
    .from(socialPostJobs)
    .where(
      sql`${socialPostJobs.status} = 'pending' OR (${socialPostJobs.status} = 'queued' AND ${socialPostJobs.updatedAt} < ${new Date(Date.now() - 10 * 60 * 1000).toISOString()})`,
    );

  let recovered = 0;
  for (const job of jobsToRecover) {
    // If queued, reset to pending first
    if (job.status === 'queued') {
      const resetResult = await db
        .update(socialPostJobs)
        .set({ status: 'pending', updatedAt: nowUTC() })
        .where(and(eq(socialPostJobs.id, job.id), eq(socialPostJobs.status, 'queued')));
      if (!resetResult.meta.changed_db) continue;
      console.log(`[automation] Reset stale queued job ${job.id} to pending`);
    }

    // Enqueue pending job
    const [post] = await db
      .select({ postTitle: dimPosts.postTitle, ogpImageUrl: dimPosts.ogpImageUrl })
      .from(dimPosts)
      .where(eq(dimPosts.postId, job.postId))
      .limit(1);

    if (post) {
      await enqueueAndMarkQueued(env, db, job.id, {
        post_id: job.postId,
        platform: job.platform as Platform,
        post_title: post.postTitle,
        post_url: `https://healthy-person-emulator.org/archives/${job.postId}`,
        og_url: post.ogpImageUrl ?? '',
        message_type: 'new',
      });
      recovered++;
    }
  }

  return { recovered };
}

// ─── Helpers ────────────────────────────────────────────────

function classifyError(err: unknown): 'terminal' | 'retryable' | 'ambiguous' {
  const msg = err instanceof Error ? err.message : String(err);

  // Terminal: auth failures
  if (/401|403|Unauthorized|Forbidden/i.test(msg)) return 'terminal';

  // Retryable: rate limits, server errors
  if (/429|500|502|503|504|rate.?limit|timeout/i.test(msg)) return 'retryable';

  // Connection errors are ambiguous
  if (/ECONNRESET|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(msg)) return 'ambiguous';

  return 'ambiguous';
}

async function updateDimPostsSocialId(
  db: ReturnType<typeof drizzle>,
  postId: number,
  platform: Platform,
  providerPostId: string,
): Promise<void> {
  const columnMap: Record<Platform, string> = {
    twitter: 'tweet_id_of_first_tweet',
    bluesky: 'bluesky_post_uri_of_first_post',
    activitypub: 'misskey_note_id_of_first_note',
  };

  // Only update if not already set (first post only)
  await db.run(
    sql`UPDATE dim_posts SET ${sql.raw(columnMap[platform])} = ${providerPostId}, is_sns_shared = 1 WHERE post_id = ${postId} AND ${sql.raw(columnMap[platform])} IS NULL`,
  );
}
