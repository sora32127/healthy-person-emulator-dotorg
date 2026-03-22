/**
 * SNS deletion dispatcher.
 */

import type { CloudflareEnv } from '~/types/env';
import type { SocialDeleteParams } from './types';
import { deleteFromTwitter } from './twitter.server';
import { deleteFromBluesky } from './bluesky.server';
import { deleteFromMisskey } from './misskey.server';

export async function deleteFromSocial(
  env: CloudflareEnv,
  params: SocialDeleteParams,
): Promise<void> {
  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[social] DRY RUN: would delete ${params.platform}: ${params.providerPostId}`);
    return;
  }

  switch (params.platform) {
    case 'twitter': {
      const creds = {
        consumerKey: await env.SS_TWITTER_CK.get(),
        consumerSecret: await env.SS_TWITTER_CS.get(),
        accessToken: await env.SS_TWITTER_AT.get(),
        accessTokenSecret: await env.SS_TWITTER_ATS.get(),
      };
      return deleteFromTwitter(creds, params.providerPostId);
    }
    case 'bluesky': {
      const creds = {
        user: await env.SS_BLUESKY_USER.get(),
        password: await env.SS_BLUESKY_PASSWORD.get(),
      };
      return deleteFromBluesky(creds, params.providerPostId);
    }
    case 'activitypub': {
      const creds = { token: await env.SS_MISSKEY_TOKEN.get() };
      return deleteFromMisskey(creds, params.providerPostId);
    }
    default:
      throw new Error(`Unknown platform: ${params.platform}`);
  }
}
