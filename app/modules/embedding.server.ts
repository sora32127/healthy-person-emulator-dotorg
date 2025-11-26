import { OpenAI } from 'openai';
import { getTagNamesByPostId, updatePostEmbedding } from './db.server';

interface CreateEmbeddingInput {
  postId: number;
  postContent: string;
  postTitle: string;
}

const OpenAIAPIKey = process.env.OPENAI_API_KEY;
const OpenAIEmbeddingModel = 'text-embedding-3-small';

export async function createEmbedding({
  postId,
  postContent,
  postTitle,
}: CreateEmbeddingInput) {
  if (!OpenAIAPIKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  const allTagNames = await getTagNamesByPostId(postId);

  const inputText = await getEmbeddingInputText(
    postContent,
    postTitle,
    allTagNames,
  );
  const { embedding, tokenCount } = await getEmbeddingResponse(inputText);
  try {
    await updatePostEmbedding(postId, embedding, tokenCount);
  } catch (error) {
    throw new Error(`Failed to update embedding: ${error}`);
  }
  return {
    status: 200,
    message: 'Embedding created successfully',
  };
}

async function getEmbeddingResponse(inputText: string) {
  if (OpenAIAPIKey === 'openai-demo-key') {
    return {
      embedding: [0.1, 0.2, 0.3],
      tokenCount: 10,
    };
  }
  const openAI = new OpenAI({ apiKey: OpenAIAPIKey });
  const response = await openAI.embeddings.create({
    model: OpenAIEmbeddingModel,
    input: inputText,
  });

  return {
    embedding: response.data[0].embedding,
    tokenCount: response.usage.total_tokens,
  };
}

async function getEmbeddingInputText(
  postContent: string,
  postTitle: string,
  allTagNames: string[],
) {
  const inputText = `タイトル: ${postTitle}\nタグ: ${allTagNames}\n本文: ${postContent}`;
  return inputText;
}
