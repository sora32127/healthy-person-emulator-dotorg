import { OpenAI } from "openai";
import { prisma } from "./db.server";

interface CreateEmbeddingInput {
    postId : number;
    postContent : string;
    postTitle : string;
}


const OpenAIAPIKey = process.env.OPENAI_API_KEY;
const OpenAIEmbeddingModel = "text-embedding-3-small"

export async function createEmbedding({ postId, postContent, postTitle } : CreateEmbeddingInput) {
    if (!OpenAIAPIKey) {
        throw new Error("OPENAI_API_KEY is not set");
    }
    const allTags = await prisma.relPostTags.findMany({
        where: { postId },
        select: {
            dimTag: {
                select: {
                    tagName: true
                }
            }
        }
    })
    const allTagNames = allTags.map(tag => tag.dimTag.tagName)

    const inputText = await getEmbeddingInputText(postContent, postTitle, allTagNames)
    const openAI = new OpenAI({apiKey: OpenAIAPIKey})
    const response = await openAI.embeddings.create({
        model: OpenAIEmbeddingModel,
        input: inputText,
    })
    
    const embedding = Array.from(response.data[0].embedding)
    const tokenCount = response.usage.total_tokens
    try {
        await prisma.$queryRaw`
            UPDATE dim_posts
            SET content_embedding = ${embedding}, token_count = ${tokenCount}
            WHERE post_id = ${postId}
        `;
        // prismaクライアントを利用すると、unsporttedなデータ型を扱うことができない
        // そのため、queryRawを利用する
        // Supabaseのクライアントを利用してembeddingを更新する際、たまに`permission denied for schema public`が出現するため、supabaseクライアントを利用しない
    }
    catch (error) {
        throw new Error(`Failed to update embedding:` + error);
    }
    return ({
        status: 200,
        message: "Embedding created successfully"
    });
}

async function getEmbeddingInputText(postContent: string, postTitle: string, allTagNames: string[]) {
    const inputText = `タイトル: ${postTitle}\nタグ: ${allTagNames}\n本文: ${postContent}`
    return inputText
}