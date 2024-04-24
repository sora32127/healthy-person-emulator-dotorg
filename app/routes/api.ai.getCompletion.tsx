import { ActionFunctionArgs } from '@remix-run/node';
import { Groq } from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY

export async function action ({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const text = formData.get("text") as string | null;
    const context = formData.get("context") as string | "";
    if (!text) {
        return new Response("Bad Request", { status: 400 });
    }
    const result = await getCompletion(text, context);
    return new Response(JSON.stringify(result), {
        headers: {
            "Content-Type": "application/json",
        },
    });
}

export async function getCompletion(text:string, context:string) {
    const groq = new Groq({
        apiKey:  GROQ_API_KEY
    });
    const result = await groq.chat.completions.create({
        messages: [
            {
                role: "system",
                content: `あなたはテキストを補完するBotです。ユーザーのテキストを受け取り、文章を補完してください。続きの文節のみを短く完結に返却してください。可能な限り文脈を読み取るよう心掛けてください。なお、コンテキストは以下の通りです。${context}`},
            {
                role: "user",
                content: text,
            }
        ],
        model: "llama3-8b-8192"
    });
    const completion = result.choices[0].message.content
    return completion
}

