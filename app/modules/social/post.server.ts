/**
 * SNS posting dispatcher.
 * Routes post requests to the appropriate platform client.
 */

import type { CloudflareEnv } from '~/types/env';
import type { SocialPostParams, SocialPostResult } from './types';
import { postToTwitter } from './twitter.server';
import { postToBluesky } from './bluesky.server';
import { postToMisskey } from './misskey.server';

export async function postToSocial(
  env: CloudflareEnv,
  params: SocialPostParams,
): Promise<SocialPostResult> {
  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[social] DRY RUN: would post to ${params.platform}: ${params.postTitle}`);
    return { providerPostId: 'dry-run' };
  }

  switch (params.platform) {
    case 'twitter': {
      const creds = {
        consumerKey: await env.SS_TWITTER_CK.get(),
        consumerSecret: await env.SS_TWITTER_CS.get(),
        accessToken: await env.SS_TWITTER_AT.get(),
        accessTokenSecret: await env.SS_TWITTER_ATS.get(),
      };
      return postToTwitter(creds, params);
    }
    case 'bluesky': {
      const creds = {
        user: await env.SS_BLUESKY_USER.get(),
        password: await env.SS_BLUESKY_PASSWORD.get(),
      };
      return postToBluesky(creds, params);
    }
    case 'activitypub': {
      const creds = { token: await env.SS_MISSKEY_TOKEN.get() };
      return postToMisskey(creds, params);
    }
    default:
      throw new Error(`Unknown platform: ${params.platform}`);
  }
}
