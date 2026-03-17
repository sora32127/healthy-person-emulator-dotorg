import { getTagNamesByPostId } from './db.server';
import { getEmbedding, upsertVectors } from './cloudflare.server';

interface CreateEmbeddingInput {
  postId: number;
  postContent: string;
  postTitle: string;
}

export async function createEmbedding({ postId, postContent, postTitle }: CreateEmbeddingInput) {
  try {
    const allTagNames = await getTagNamesByPostId(postId);
    const inputText = getEmbeddingInputText(postContent, postTitle, allTagNames);

    const embedding = await getEmbedding(inputText);

    await upsertVectors([
      {
        id: String(postId),
        values: embedding,
        metadata: {
          postId,
          postTitle,
          embeddingModel: 'embeddinggemma-300m',
          updatedAt: new Date().toISOString(),
        },
      },
    ]);

    return {
      status: 200,
      message: 'Embedding created successfully',
    };
  } catch (error) {
    // Vectorize/AI unavailable (e.g. local dev) — skip embedding
    console.warn('createEmbedding failed, skipping:', (error as Error).message);
    return {
      status: 200,
      message: 'Embedding skipped (AI unavailable)',
    };
  }
}

function getEmbeddingInputText(
  postContent: string,
  postTitle: string,
  allTagNames: string[],
) {
  return `タイトル: ${postTitle}\nタグ: ${allTagNames}\n本文: ${postContent}`;
}
