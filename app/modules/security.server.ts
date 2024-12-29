import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";


const CF_TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CF_TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
const CF_TURNSTILE_SITEKEY = "1x00000000000000000000AA";

export async function validateRequest(token: string, ipAddress: string) {
  if (!CF_TURNSTILE_SECRET_KEY) {
    throw new Error("CF_TURNSTILE_SECRET_KEY is not set");
  }
  const formData = new FormData();
  const idempotencyKey = crypto.randomUUID();
  formData.append('secret', CF_TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  formData.append("remoteip", ipAddress);
  formData.append("idempotency_key", idempotencyKey);
  for (const [key, value] of formData.entries()) {
    console.log(key, value);
  }
  
  const res = await fetch(CF_TURNSTILE_VERIFY_ENDPOINT, {
    method: 'POST',
    body: formData,
  });
  const outCome = await res.json();
  console.log("outCome", outCome);
  if (outCome.success) {
    return true;
  }
  return false;
}

export async function getTurnStileSiteKey() {
  if (!CF_TURNSTILE_SITEKEY) {
    throw new Error("CF_TURNSTILE_SITEKEY is not set");
  }
  return CF_TURNSTILE_SITEKEY; 
}


export async function getHashedUserIPAddress(request: Request){
  const headers = request.headers;
  const ipAddressFromXForwardedFor = headers.get("X-Forwarded-For");
  const ipAddressFromCFConnectingIp = headers.get("CF-Connecting-IP");
  const ipAddress = ipAddressFromCFConnectingIp || ipAddressFromXForwardedFor || "";
  return ipAddress;
}

export async function getJudgeWelcomedByGenerativeAI(postContent: string, postTitle: string){
  const GOOGLE_GENERATIVE_API_KEY = process.env.GOOGLE_GENERATIVE_API_KEY;
  if (!GOOGLE_GENERATIVE_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_API_KEY is not set");
  }

  const schema = {
    description: "歓迎される投稿かどうかを判断した結果",
    type: SchemaType.OBJECT,
    properties: {
        isWelcomed: {
            description: "歓迎される投稿の場合はtrue、歓迎されない投稿の場合はfalse",
            type: SchemaType.BOOLEAN,
        },
        explanation: {
            description: "判断した理由のカテゴリ",
            type: SchemaType.STRING,
            enum: [
              "テスト投稿です",
              "スパム投稿です",
              "基本的人権を侵害する行為が奨励されています",
              "違法な行為を奨励する内容を含みます",
              "ガイドラインに準拠した投稿です"
            ],
        },
    },
    required: ["isWelcomed", "explanation"],
  }


  const generativeAi = new GoogleGenerativeAI(GOOGLE_GENERATIVE_API_KEY);
  const model = generativeAi.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
      },
  });

  const prompt = `
  # 指示
  - あなたはHTMLで表現されたテキストを分析して、そのテキストが「歓迎されない投稿」に該当するかどうかを判断してください。
  - 歓迎されない条件に該当する場合は「歓迎されない投稿」と判断し、条件に該当していても例外に該当する場合は「歓迎される投稿」と判断してください。
  - 判断した理由も含めてください

  # 歓迎されない投稿の条件
  - 自らが経験した知識ではない知識について記述された投稿
  - 基本的人権を侵害する行為を奨励する投稿
  - 違法な行為を奨励する内容を含む投稿
  - テスト投稿だとわかるもの
  - スパム投稿

  # 例外
  - 社会通念上望ましくない行為であっても、違法な行為・基本的人権を侵害を侵害する行為を奨励するわけではないなら全て「歓迎される投稿」と判断してください。
  - 社会通念上望ましくない行為であっても、反省している場合は「歓迎される投稿」と判断してください。
  - 違法・もしくは基本的人権を侵害するような表現が含まれていた場合でも、奨励しているわけではない場合は「歓迎される投稿」と判断してください。
  - 違法・もしくは基本的人権を侵害するような表現が含まれていた場合でも、反省している場合は「歓迎される投稿」と判断してください。

  HTMLで表現されたテキストは以下の通りです。

  ${postTitle}
  ${postContent}
  `;

  const result = await model.generateContent(prompt);
  const parsedResult = JSON.parse(result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '') || {};
  return {isWelcomed: parsedResult.isWelcomed, explanation: parsedResult.explanation};
}