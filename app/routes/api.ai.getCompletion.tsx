import { ActionFunctionArgs } from '@remix-run/node';
import { Groq } from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY

export async function action ({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const text = formData.get("text") as string | null;
    const context = formData.get("context") as string | "";
    const prompt = formData.get("prompt") as string | "";
    if (!text) {
        return new Response("Bad Request", { status: 400 });
    }
    const result = await getCompletion(text, context, prompt);
    return new Response(JSON.stringify(result), {
        headers: {
            "Content-Type": "application/json",
        },
    });
}

function createPrompt(prompt: string) {
    if (prompt == "reflection") {
        return "ユーザーは自分の行動に何が問題があったのか気にしています。あなたは、何が問題だったのかを考える補佐をしてください。"
    } else if(prompt== "counterReflection") {
        return "ユーザーは、もし自分がその行動をしなかったらどうなっていたのかや、本当はどうするべきだったのか反実仮想をしようとしています。あなたは反実仮想の補佐をしてください。"
    } else if (prompt == "note") {
        return "ユーザーは、書ききれなかった何かを補足したいと思っています。あなたは、ユーザーの補足を補佐してください。"
    } else if (prompt == "title") {
        return "ユーザーは、タイトルを考えるのに困っています。あなたは、タイトルを考える補佐をしてください。"
    }
}

export async function getCompletion(text:string, context:string, prompt:string) {
    const groq = new Groq({
        apiKey:  GROQ_API_KEY
    });
    const promptSentence = createPrompt(prompt)
    const result = await groq.chat.completions.create({
        messages: [
            {
                role: "system",
                content: `${promptSentence}ユーザーのテキストを受け取り、日本語で文章を補完してください。続きの文節のみを短く完結に返却してください。なお、コンテキストは以下の通りです。${context}`},
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

