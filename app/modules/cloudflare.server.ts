let _cfWorkersAiToken: string | undefined;
let _cloudflareAccountId: string | undefined;
let _vectorizeIndexName: string | undefined;
let _cloudflareInitialized = false;

export function initCloudflare(env: {
  CF_WORKERS_AI_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  VECTORIZE_INDEX_NAME?: string;
}) {
  _cfWorkersAiToken = env.CF_WORKERS_AI_TOKEN;
  _cloudflareAccountId = env.CLOUDFLARE_ACCOUNT_ID || "9ecb9a8692f7c2c5c56387d93a9a1e60";
  _vectorizeIndexName = env.VECTORIZE_INDEX_NAME || "embeddings-index";
  _cloudflareInitialized = true;
}

function ensureCloudflareInit() {
  if (_cloudflareInitialized) return;
  const env = (globalThis as any).__cloudflareEnv;
  if (env) {
    initCloudflare({
      CF_WORKERS_AI_TOKEN: env.CF_WORKERS_AI_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
      VECTORIZE_INDEX_NAME: env.VECTORIZE_INDEX_NAME,
    });
  }
}

const TIMEOUT_MS = 5000;

function getBaseUrl(): string {
  const accountId = _cloudflareAccountId || "9ecb9a8692f7c2c5c56387d93a9a1e60";
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
}

function getToken(): string {
  ensureCloudflareInit();
  if (!_cfWorkersAiToken) {
    throw new Error("CF_WORKERS_AI_TOKEN is not set");
  }
  return _cfWorkersAiToken;
}

function getIndexName(): string {
  return _vectorizeIndexName || "embeddings-index";
}

async function cfFetch<T>(
  path: string,
  body: unknown,
  isNdjson = false,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": isNdjson
          ? "application/x-ndjson"
          : "application/json",
      },
      body: isNdjson ? (body as string) : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cloudflare API error ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ----- Workers AI: EmbeddingGemma-300m -----

interface WorkersAIEmbeddingResponse {
  result: { data: number[][] };
  success: boolean;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const data = await cfFetch<WorkersAIEmbeddingResponse>(
    "/ai/run/@cf/google/embeddinggemma-300m",
    { text: [text] },
  );

  if (!data.success || !data.result?.data?.[0]) {
    throw new Error(
      `Workers AI unexpected response: ${JSON.stringify(data)}`,
    );
  }
  return data.result.data[0];
}

// ----- Vectorize -----

interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
  values?: number[];
}

interface VectorizeQueryResponse {
  result: { count: number; matches: VectorizeMatch[] };
  success: boolean;
}

interface VectorizeGetByIdsResponse {
  result: VectorizeMatch[];
  success: boolean;
}

interface VectorizeUpsertResponse {
  result: { count: number };
  success: boolean;
}

interface VectorInput {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export async function upsertVectors(vectors: VectorInput[]): Promise<number> {
  const ndjson = vectors
    .map((v) => JSON.stringify(v))
    .join("\n");

  const data = await cfFetch<VectorizeUpsertResponse>(
    `/vectorize/v2/indexes/${getIndexName()}/upsert`,
    ndjson,
    true,
  );

  if (!data.success) {
    throw new Error(`Vectorize upsert failed: ${JSON.stringify(data)}`);
  }
  return data.result.count;
}

export async function querySimilar(
  vector: number[],
  topK: number,
): Promise<VectorizeMatch[]> {
  const data = await cfFetch<VectorizeQueryResponse>(
    `/vectorize/v2/indexes/${getIndexName()}/query`,
    { vector, topK, returnMetadata: "all" },
  );

  if (!data.success) {
    throw new Error(`Vectorize query failed: ${JSON.stringify(data)}`);
  }
  return data.result.matches;
}

export async function getVectorsByIds(
  ids: string[],
): Promise<VectorizeMatch[]> {
  const data = await cfFetch<VectorizeGetByIdsResponse>(
    `/vectorize/v2/indexes/${getIndexName()}/get_by_ids`,
    { ids },
  );

  if (!data.success) {
    throw new Error(`Vectorize get-by-ids failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

export async function deleteVectors(ids: string[]): Promise<void> {
  await cfFetch(
    `/vectorize/v2/indexes/${getIndexName()}/delete_by_ids`,
    { ids },
  );
}
