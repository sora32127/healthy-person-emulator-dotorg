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

function createPrompt(promptType: string) {
    switch(promptType) {
        case "reflection":
            return "I am considering what was wrong with my actions. Please assist me in reflecting on what went wrong.";
        case "counterReflection":
            return "Let's hypothesize about what would have happened if I had not taken that action and what I should have actually done. Please assist me in constructing these counterfactuals.";
        case "note":
            return "I want to add something that I couldn't write down before. Please assist me in supplementing this note.";
        case "title":
            return "I'm having trouble coming up with a title. Please help me think of an appropriate title.";
        default:
            return "";
    }
}

export async function getCompletion(text: string, context: string, promptType: string) {
    const openAI = new OpenAI({
        apiKey: OPENAI_API_KEY,
    });

    const promptText = createPrompt(promptType);
    const result = await openAI.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a proficient assistant for generating natural and grammatically correct Japanese compositions. Please generate two continuations of the user's input that consider the given context and capture the user's intent accurately. **Your response is limited to valid JSON format.** The format should be:
            {
              result: {
                completion: Array<string> and length is 2
              }
            }
            Here is your task: ${promptText}`
          },
          {
            role: "assistant",
            content: `Understood. I will generate two natural continuations of the Japanese text concisely, keeping in mind the following context information:\nContext: ${context}`,
          },
          {
            role: "user",
            content: `Please continue the following sentence twice, considering the context, in natural Japanese and concisely, aiming for about 40 characters each:\n"${text}"`,
          }
        ],
        model: 'gpt-4o'
       });
    const completion = JSON.parse(result.choices[0].message.content || "");
    return completion.result.completion;
}
