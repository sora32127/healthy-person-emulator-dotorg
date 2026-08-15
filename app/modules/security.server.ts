import { z } from 'zod';

const CF_TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const WELCOMED_EXPLANATION = 'ガイドラインに準拠した投稿です';
const GUIDELINE_EXPLANATIONS = [
  '自身の経験に基づかない知識が記述されています',
  'テスト投稿です',
  'スパム投稿です',
  '基本的人権を侵害する行為が奨励されています',
  '違法な行為を奨励する内容を含みます',
  WELCOMED_EXPLANATION,
] as const;
const GUIDELINE_CHECK_SCHEMA = z
  .object({
    isWelcomed: z.boolean(),
    explanation: z.enum(GUIDELINE_EXPLANATIONS),
  })
  .strict()
  .refine(({ isWelcomed, explanation }) => isWelcomed === (explanation === WELCOMED_EXPLANATION));

let _cfTurnstileSecretKey: string | undefined;
let _cfTurnstileSiteKey: string | undefined;
let _aiBinding: Ai | undefined;
let _securityInitialized = false;

export function initSecurity(env: {
  CF_TURNSTILE_SECRET_KEY: string;
  CF_TURNSTILE_SITEKEY: string;
  AI: Ai;
}) {
  _cfTurnstileSecretKey = env.CF_TURNSTILE_SECRET_KEY;
  _cfTurnstileSiteKey = env.CF_TURNSTILE_SITEKEY;
  _aiBinding = env.AI;
  _securityInitialized = true;
}

function ensureSecurityInit() {
  if (_securityInitialized) return;
  const env = (globalThis as any).__cloudflareEnv;
  if (env) {
    initSecurity({
      CF_TURNSTILE_SECRET_KEY: env.CF_TURNSTILE_SECRET_KEY,
      CF_TURNSTILE_SITEKEY: env.CF_TURNSTILE_SITEKEY,
      AI: env.AI,
    });
  }
}

export async function validateRequest(token: string, ipAddress: string) {
  ensureSecurityInit();
  if (!_cfTurnstileSecretKey) {
    throw new Error('CF_TURNSTILE_SECRET_KEY is not set');
  }
  const formData = new FormData();
  const idempotencyKey = crypto.randomUUID();
  formData.append('secret', _cfTurnstileSecretKey);
  formData.append('response', token || '');
  formData.append('remoteip', ipAddress);
  formData.append('idempotency_key', idempotencyKey);
  for (const [key, value] of formData.entries()) {
    console.log(key, value);
  }

  const res = await fetch(CF_TURNSTILE_VERIFY_ENDPOINT, {
    method: 'POST',
    body: formData,
  });
  const outCome = (await res.json()) as { success: boolean };
  console.log('outCome', outCome);
  if (outCome.success) {
    return true;
  }
  return false;
}

export async function getTurnStileSiteKey() {
  ensureSecurityInit();
  if (!_cfTurnstileSiteKey) {
    throw new Error('CF_TURNSTILE_SITEKEY is not set');
  }
  return _cfTurnstileSiteKey;
}

export async function getHashedUserIPAddress(request: Request) {
  const headers = request.headers;
  const ipAddressFromXForwardedFor = headers.get('X-Forwarded-For');
  const ipAddressFromCFConnectingIp = headers.get('CF-Connecting-IP');
  const ipAddress = ipAddressFromCFConnectingIp || ipAddressFromXForwardedFor || '';
  return ipAddress;
}

export async function getJudgeWelcomedByGenerativeAI(postContent: string, postTitle: string) {
  ensureSecurityInit();

  if (!_aiBinding) {
    console.warn('[security] AI binding not available, skipping guideline check');
    return { isWelcomed: true, explanation: WELCOMED_EXPLANATION };
  }

  const systemPrompt = `あなたはHTMLで表現されたテキストを分析して、そのテキストが「歓迎されない投稿」に該当するかどうかを判断するAIです。
歓迎されない条件に該当する場合は「歓迎されない投稿」と判断し、条件に該当していても例外に該当する場合は「歓迎される投稿」と判断してください。

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

JSONで結果を返してください。

出力は必ず {"isWelcomed": boolean, "explanation": string} の2キーだけを持つJSONオブジェクトにし、Markdownのコードフェンスは使わないでください。
explanationは${GUIDELINE_EXPLANATIONS.map((explanation) => `「${explanation}」`).join('、')}のいずれかだけを使用してください。
isWelcomedがtrueの場合は「${WELCOMED_EXPLANATION}」、falseの場合はそれ以外の理由を使用してください。`;

  try {
    const result = await _aiBinding.run('@cf/mistralai/mistral-small-3.1-24b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${postTitle}\n${postContent}` },
      ],
      guided_json: z.toJSONSchema(GUIDELINE_CHECK_SCHEMA),
      temperature: 0,
      max_tokens: 128,
    });
    return GUIDELINE_CHECK_SCHEMA.parse(JSON.parse(result.response));
  } catch (error) {
    const errorKind =
      error instanceof SyntaxError
        ? 'invalid_json'
        : error instanceof z.ZodError
          ? 'invalid_schema'
          : 'ai_error';
    console.warn(`[security] AI guideline check failed (${errorKind}), defaulting to welcomed`);
    return { isWelcomed: true, explanation: WELCOMED_EXPLANATION };
  }
}
