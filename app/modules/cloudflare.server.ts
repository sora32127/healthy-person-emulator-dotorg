let _aiBinding: Ai | undefined;
let _vectorizeBinding: VectorizeIndex | undefined;
let _cloudflareInitialized = false;

export function initCloudflare(env: { AI: Ai; VECTORIZE: VectorizeIndex }) {
  _aiBinding = env.AI;
  _vectorizeBinding = env.VECTORIZE;
  _cloudflareInitialized = true;
}

function ensureCloudflareInit() {
  if (_cloudflareInitialized) return;
  const env = (globalThis as any).__cloudflareEnv;
  if (env) {
    initCloudflare({
      AI: env.AI,
      VECTORIZE: env.VECTORIZE,
    });
  }
}

// ----- Workers AI: EmbeddingGemma-300m -----

export async function getEmbedding(text: string): Promise<number[]> {
  ensureCloudflareInit();
  if (!_aiBinding) {
    throw new Error('AI binding is not available');
  }

  const result = await _aiBinding.run('@cf/google/embeddinggemma-300m', {
    text: [text],
  });

  const data = (result as { data: number[][] }).data;
  if (!data?.[0]) {
    throw new Error(`Workers AI unexpected response: ${JSON.stringify(result)}`);
  }
  return data[0];
}

// ----- Vectorize -----

interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
  values?: number[];
}

interface VectorInput {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

function getVectorize(): VectorizeIndex {
  ensureCloudflareInit();
  if (!_vectorizeBinding) {
    throw new Error('VECTORIZE binding is not available');
  }
  return _vectorizeBinding;
}

export async function upsertVectors(vectors: VectorInput[]): Promise<number> {
  const result = await getVectorize().upsert(vectors);
  return (result as { count: number }).count;
}

export async function querySimilar(vector: number[], topK: number): Promise<VectorizeMatch[]> {
  const result = await getVectorize().query(vector, { topK, returnMetadata: 'all' });
  return result.matches;
}

export async function getVectorsByIds(ids: string[]): Promise<VectorizeMatch[]> {
  const result = await getVectorize().getByIds(ids);
  return result as unknown as VectorizeMatch[];
}

export async function deleteVectors(ids: string[]): Promise<void> {
  await getVectorize().deleteByIds(ids);
}
