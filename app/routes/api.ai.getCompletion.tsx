import { ActionFunctionArgs } from '@remix-run/node';
import { OpenAI } from 'openai';


const OPENAI_API_KEY = process.env.OPENAI_API_KEY

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
        return "自分の行動に何が問題があったのか気にしています。あなたは、何が問題だったのかを考える補佐をしてください。"
    } else if(prompt== "counterReflection") {
        return "もし自分がその行動をしなかったらどうなっていたのかや、本当はどうするべきだったのか反実仮想をしようとしています。あなたは反実仮想の補佐をしてください。"
    } else if (prompt == "note") {
        return "書ききれなかった何かを補足したいと思っています。あなたは、ユーザーの補足を補佐してください。"
    } else if (prompt == "title") {
        return "タイトルを考えるのに困っています。あなたは、タイトルを考える補佐をしてください。"
    }
}

export async function getCompletion(text:string, context:string, prompt:string) {
    const openAI = new OpenAI({
        apiKey: OPENAI_API_KEY,
    })

    const promptSentence = createPrompt(prompt)
    const result = await openAI.chat.completions.create({
        messages: [
            {
                role: "user",
                content: `${promptSentence}「${text}」に続く文節を考えてください`,
            },
            {
                role: "user",
                content: `補足情報は以下の通りです。文章を生成する参考にしてください。${context}`,
            },
            {
                role: "user",
                content: `「${text}」は省略し、続きの文節のみを短く完結に返却してください。日本語のみで生成してください。`,
            }
        ],
        model: 'gpt-3.5-turbo'
    });
    const completion = result.choices[0].message.content
    return completion
}

