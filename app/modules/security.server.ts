import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export async function validateRequest(token: string, origin: string) {

  const formData = new FormData();
  formData.append('cf-turnstile-response', token);
    
  const res = await fetch(`${origin}/api/verify`, {
    method: 'POST',
    body: formData,
  });

  try {
    const data = await res.json();
    return data.success;
  } catch (error) {
    console.error('Error verifying Turnstile response:', error)
    // 一次的な措置
    return true;
  }
}


export async function getTurnStileSiteKey() {
  const key = process.env.CF_TURNSTILE_SITEKEY;
  if (!key) {
    throw new Error("CF_TURNSTILE_SITEKEY is not set");
  }
  return key;
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
            description: "簡潔なユーザー向けの説明(60文字以内)。警告表示で利用する。",
            type: SchemaType.STRING,
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
  - 理由は60文字以内で表現し、この記事がどのような要素を含んでいるかを簡潔に表現してください。

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