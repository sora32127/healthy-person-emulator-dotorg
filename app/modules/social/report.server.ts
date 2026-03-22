/**
 * SNS report tasks (legendary articles, weekly summary).
 * Ported from container/tasks/report_legendary_article.py and report_weekly_summary.py.
 */

import type { CloudflareEnv } from '~/types/env';
import { queryBigQuery } from '~/modules/bigquery.server';
import { postToTwitter, tweetRaw } from './twitter.server';
import type { TwitterCredentials } from './types';

function requireBigQueryCredentials(env: CloudflareEnv): string {
  if (!env.BIGQUERY_CREDENTIALS) {
    throw new Error('BIGQUERY_CREDENTIALS is not configured');
  }
  return env.BIGQUERY_CREDENTIALS;
}

async function getTwitterCreds(env: CloudflareEnv): Promise<TwitterCredentials> {
  return {
    consumerKey: await env.SS_TWITTER_CK.get(),
    consumerSecret: await env.SS_TWITTER_CS.get(),
    accessToken: await env.SS_TWITTER_AT.get(),
    accessTokenSecret: await env.SS_TWITTER_ATS.get(),
  };
}

// --- Legendary articles ---

export async function reportLegendary(env: CloudflareEnv): Promise<{ processed: number }> {
  const bqCreds = requireBigQueryCredentials(env);
  const articles = await queryBigQuery(
    bqCreds,
    'SELECT * FROM `healthy-person-emulator.HPE_REPORTS.report_new_legend_posts`',
  );

  if (articles.length === 0) {
    return { processed: 0 };
  }

  // Add "殿堂入り" tag (tagId=575) via internal API
  for (const article of articles) {
    const postId = article.post_id as number;
    await fetch(`${env.BASE_URL}/api/internal/add-tag-to-post`, {
      method: 'POST',
      headers: {
        'X-API-Key': env.INTERNAL_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'HPE-Automation-Worker/1.0',
      },
      body: JSON.stringify({ postId, tagId: 575 }),
    });
  }

  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[report] DRY RUN: would tweet ${articles.length} legendary articles`);
    return { processed: articles.length };
  }

  const creds = await getTwitterCreds(env);
  for (const article of articles) {
    const postId = article.post_id as number;
    const postTitle = article.post_title as string;
    const postUrl = `https://healthy-person-emulator.org/archives/${postId}`;

    await postToTwitter(creds, {
      postTitle,
      postUrl,
      messageType: 'legendary',
    });
  }

  return { processed: articles.length };
}

// --- Weekly summary ---

export function createWeeklyTweetText(weeklyData: Array<Record<string, unknown>>): string {
  let text = '【今週の人気投稿】\n';
  const top3 = weeklyData.slice(0, 3);
  for (let i = 0; i < top3.length; i++) {
    const post = top3[i];
    const postUrl = `https://healthy-person-emulator.org/archives/${post.post_id}`;
    text += `\n${i + 1} : ${post.post_title} \n${postUrl}\n`;
  }
  text += `\nhttps://healthy-person-emulator.org/archives/${weeklyData[0].post_id}`;
  return text;
}

export async function reportWeekly(env: CloudflareEnv): Promise<{ posted: boolean }> {
  const bqCreds = requireBigQueryCredentials(env);
  const weeklyData = await queryBigQuery(
    bqCreds,
    'SELECT * FROM `healthy-person-emulator.HPE_REPORTS.report_weekly_summary`',
  );

  if (weeklyData.length === 0) {
    return { posted: false };
  }

  const tweetText = createWeeklyTweetText(weeklyData);

  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[report] DRY RUN: would tweet weekly summary:\n${tweetText}`);
    return { posted: false };
  }

  const creds = await getTwitterCreds(env);
  await tweetRaw(creds, tweetText);

  return { posted: true };
}
