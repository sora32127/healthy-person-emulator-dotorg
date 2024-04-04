import { json } from "@remix-run/node";
import { supabase } from "./supabase.server";

interface CreateEmbeddingInput {
    postId : number;
    postContent : string;
}

const OpenAIAPIKey = process.env.OPENAI_API_KEY;
const OpenAIEmbeddingEndpoint = "https://api.openai.com/v1/embeddings"
const OpenAIEmbeddingModel = "text-embedding-3-small"

export async function createEmbedding({ postId, postContent } : CreateEmbeddingInput) {
    if (!OpenAIAPIKey) {
        throw new Error("OPENAI_API_KEY is not set");
    }

    const response = await fetch(OpenAIEmbeddingEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OpenAIAPIKey}`
        },
        body: JSON.stringify({
            input: postContent,
            model: OpenAIEmbeddingModel,
            encoding_format : "float",
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to create embedding: ${response.statusText}`);
    }

    const parsedResponse = await response.json();
    const embedding = Array.from(parsedResponse.data[0].embedding)

    const { error } = await supabase.from("dim_posts").update({
        content_embedding: embedding
    }).eq("post_id", postId);


    if (error) {
        throw new Error(`Failed to update embedding:` + error.message);
    }

    return json({
        status: 200,
        message: "Embedding created successfully"
    });
}