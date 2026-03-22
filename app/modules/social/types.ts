export const PLATFORMS = ['twitter', 'bluesky', 'activitypub'] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface SocialPostParams {
  platform: Platform;
  postTitle: string;
  postUrl: string;
  ogUrl: string;
  messageType: 'new' | 'legendary' | 'random';
}

export interface SocialPostResult {
  providerPostId: string;
}

export interface SocialDeleteParams {
  platform: Platform;
  providerPostId: string;
}

export interface TwitterCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface BlueskyCredentials {
  user: string;
  password: string;
}

export interface MisskeyCredentials {
  token: string;
}

export const TYPE_PREFIX: Record<string, string> = {
  new: '新規記事',
  legendary: '殿堂入り',
  random: 'ランダム',
};
