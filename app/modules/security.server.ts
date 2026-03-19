const CF_TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let _cfTurnstileSecretKey: string | undefined;
let _cfTurnstileSiteKey: string | undefined;
let _aiBinding: Ai | undefined;
let _nodeEnv: string | undefined;
let _securityInitialized = false;

export function initSecurity(env: {
  CF_TURNSTILE_SECRET_KEY: string;
  CF_TURNSTILE_SITEKEY: string;
  AI: Ai;
  NODE_ENV?: string;
}) {
  _cfTurnstileSecretKey = env.CF_TURNSTILE_SECRET_KEY;
  _cfTurnstileSiteKey = env.CF_TURNSTILE_SITEKEY;
  _aiBinding = env.AI;
  _nodeEnv = env.NODE_ENV;
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
      NODE_ENV: env.NODE_ENV,
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
  formData.append(
    'secret',
    _nodeEnv === 'development'
      ? '1x0000000000000000000000000000000AA'
      : _cfTurnstileSecretKey,
  );
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
  if (_nodeEnv === 'development') {
    return '1x00000000000000000000AA'; // Always return true
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
    return { isWelcomed: true, explanation: 'テスト投稿です' };
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

JSONで結果を返してください。`;

  const result = await _aiBinding.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${postTitle}\n${postContent}` },
    ],
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'guideline_check',
        schema: {
          type: 'object',
          properties: {
            isWelcomed: { type: 'boolean' },
            explanation: {
              type: 'string',
              enum: [
                'テスト投稿です',
                'スパム投稿です',
                '基本的人権を侵害する行為が奨励されています',
                '違法な行為を奨励する内容を含みます',
                'ガイドラインに準拠した投稿です',
              ],
            },
          },
          required: ['isWelcomed', 'explanation'],
        },
        strict: true,
      },
    },
  });

  const responseText = (result as { response?: string }).response;
  if (!responseText) {
    console.warn('[security] AI returned empty response, defaulting to welcomed');
    return { isWelcomed: true, explanation: 'ガイドラインに準拠した投稿です' };
  }
  try {
    const parsedResult = JSON.parse(responseText) as {
      isWelcomed: boolean;
      explanation: string;
    };
    return {
      isWelcomed: parsedResult.isWelcomed,
      explanation: parsedResult.explanation,
    };
  } catch {
    console.warn('[security] Failed to parse AI response, defaulting to welcomed:', responseText);
    return { isWelcomed: true, explanation: 'ガイドラインに準拠した投稿です' };
  }
}
