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
    } else {
        return ""
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
                role: "system",
                content: `あなたは優秀な日本語の作文アシスタントです。ユーザーが入力した文章の続きを、自然で文法的に正しい日本語で簡潔に生成してください。与えられた文脈を考慮し、ユーザーの意図を汲み取って適切な文章を生成することを心がけてください。${promptSentence}`
            },
            {
                role: "assistant",
                content: `承知しました。ユーザーの入力文に続く自然な日本語の文章を簡潔に生成いたします。以下の文脈情報を参考にします。\n文脈情報: ${context}`,
            },
            {
                role: "user",
                content: `次の文章の続きを、文脈を考慮して自然な日本語で簡潔に生成してください。40文字程度でお願いします。\n「${text}」`,
            }
        ],
        model: 'gpt-3.5-turbo'
    });
    const completion = result.choices[0].message.content
    return completion
}