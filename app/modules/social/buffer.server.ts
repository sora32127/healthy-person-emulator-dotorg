/**
 * Buffer API client for X (Twitter) posting via Buffer.
 *
 * 対象: X (Twitter) のみ。Buffer 経由で投稿・削除を行う。
 *
 * API仕様 (developers.buffer.com):
 *  - エンドポイント: POST https://api.buffer.com (GraphQL 単一エンドポイント)
 *  - 認証: Authorization: Bearer <APIキー>
 *
 * セキュリティ注意:
 *  - 本番APIキーは Cloudflare Secrets Store (SS_BUFFER_API_KEY) から取得する。
 *  - 絶対にログ出力・ハードコードしないこと。エラー文言にも含めない。
 */

const BUFFER_ENDPOINT = 'https://api.buffer.com';

interface GqlEnvelope {
  data?: unknown;
  errors?: Array<{ message: string }>;
}

async function gql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(BUFFER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Buffer request failed (${res.status})`);
  }

  const json = JSON.parse(bodyText) as GqlEnvelope;
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Buffer API error: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!json.data) {
    throw new Error('Buffer API returned no data');
  }
  return json.data as T;
}

interface ChannelInfo {
  id: string;
  name: string;
  service: string;
}

/**
 * Buffer アカウント配下の X (Twitter) チャンネルIDを解決する。
 * 対象は X のみのため、初回に org → channel を引き、X チャンネルを返す。
 */
export async function resolveXChannelId(apiKey: string): Promise<string> {
  const orgData = await gql<{ account: { organizations: { id: string }[] } }>(
    apiKey,
    `query GetOrg { account { organizations { id } } }`,
  );
  const orgId = orgData?.account?.organizations?.[0]?.id;
  if (!orgId) throw new Error('Buffer: organization not found');

  // organizationId は OrganizationId スカラー型が要求されるため、変数ではなくインライン化する
  const chData = await gql<{ channels: ChannelInfo[] }>(
    apiKey,
    `query GetChannels {
      channels(input: { organizationId: "${orgId}" }) { id name service }
    }`,
  );

  const x = chData.channels?.find(
    (c) => c.service.toLowerCase() === 'twitter' || c.service.toLowerCase() === 'x',
  );
  if (!x) throw new Error('Buffer: X (Twitter) channel not found');
  return x.id;
}

export interface BufferPostParams {
  text: string;
  imageUrl?: string;
  /** 投稿実行時刻 (ISO8601 UTC)。省略時は即時 (customScheduled + now)。 */
  dueAt?: string;
}

export interface BufferPostResult {
  bufferPostId: string;
}

/**
 * Buffer 経由で X に即時投稿する。画像は公開URL (R2) を渡す。
 * 成功時は Buffer の Post ID を返す（X のツイートIDではない）。
 */
export async function postToXViaBuffer(
  apiKey: string,
  params: BufferPostParams,
): Promise<BufferPostResult> {
  const channelId = await resolveXChannelId(apiKey);

  const assets = params.imageUrl
    ? [{ image: { url: params.imageUrl } }]
    : [];

  // dueAt 指定があれば customScheduled、なければ即時投稿 shareNow
  // （dueAt=現在時刻は「未来でなければならない」ため即時投稿は shareNow を使う）
  const mode = params.dueAt ? 'customScheduled' : 'shareNow';
  const input: Record<string, unknown> = {
    text: params.text,
    channelId,
    schedulingType: 'automatic',
    mode,
    assets,
  };
  if (params.dueAt) {
    input.dueAt = params.dueAt;
  }

  const data = await gql<{
    createPost: { post?: { id?: string } | null; message?: string };
  }>(
    apiKey,
    `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }`,
    { input },
  );

  const createPost = data.createPost;
  if (createPost.message) {
    throw new Error(`Buffer createPost error: ${createPost.message}`);
  }
  const bufferPostId = createPost.post?.id;
  if (!bufferPostId) {
    throw new Error('Buffer createPost succeeded but returned no post id');
  }
  return { bufferPostId };
}

/**
 * Buffer の Post ID で投稿を削除する（X API は使わない）。
 */
export async function deleteBufferPost(
  apiKey: string,
  bufferPostId: string,
): Promise<void> {
  const data = await gql<{
    deletePost: { id?: string; message?: string };
  }>(
    apiKey,
    `mutation DeletePost($input: DeletePostInput!) {
      deletePost(input: $input) {
        ... on DeletePostSuccess { id }
        ... on VoidMutationError { message }
      }
    }`,
    { input: { id: bufferPostId } },
  );

  if (data.deletePost.message) {
    throw new Error(`Buffer deletePost error: ${data.deletePost.message}`);
  }
}

export interface BufferPostState {
  status: string;
  externalLink: string | null;
}

/**
 * Buffer の Post ID から、送信状態と公開URL (externalLink) を取得する。
 * status === 'sent' になると externalLink に実X投稿URLが入る。
 */
export async function fetchBufferPostState(
  apiKey: string,
  bufferPostId: string,
): Promise<BufferPostState> {
  const data = await gql<{
    post: { status?: string | null; externalLink?: string | null } | null;
  }>(
    apiKey,
    `query GetPost($input: PostInput!) {
      post(input: $input) { status externalLink }
    }`,
    { input: { id: bufferPostId } },
  );

  const post = data.post;
  return {
    status: post?.status ?? 'unknown',
    externalLink: post?.externalLink ?? null,
  };
}

/**
 * externalLink (例: https://x.com/{handle}/status/{tweetId}) から実XツイートIDを抽出する。
 * 抽出できない場合は null。
 */
export function extractXStatusIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // URL 末尾の /status/{id} を拾う
  const m = url.match(/\/status\/([A-Za-z0-9_]+)/i);
  return m ? m[1] : null;
}

/**
 * Buffer 投稿が「実際にXへ公開された (status: sent)」状態になるまで待ち、
 * externalLink から実XツイートIDを回収する。
 *
 * - Queue consumer の wall time 上限(15分)の範囲内であること
 *   （fetch 待ちはCPU時間に含まれない）
 * - タイムアウト or status: error で実X IDが得られなかった場合は null を返す
 *   （best-effort。この場合は公開リンクは付かず、後続の reconcile で補完可能）
 */
export async function waitForBufferPostSent(
  apiKey: string,
  bufferPostId: string,
  opts?: { pollIntervalMs?: number; maxWaitMs?: number },
): Promise<string | null> {
  const pollIntervalMs = opts?.pollIntervalMs ?? 15_000;
  const maxWaitMs = opts?.maxWaitMs ?? 5 * 60_000; // 5分
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const state = await fetchBufferPostState(apiKey, bufferPostId);
    if (state.status === 'sent' || state.status === 'error') {
      return extractXStatusIdFromUrl(state.externalLink);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return null;
}
