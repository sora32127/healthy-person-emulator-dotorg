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

/** Jev noul: treat probability >= 0.5 as true (welcomed). */
const NOUL_TRUE_THRESHOLD = 0.5;

/**
 * Stable choice keys for typesafe/jev → Japanese explanation strings stored in DB/UI.
 * Keys stay ASCII so the model returns a stable token; values match GUIDELINE_EXPLANATIONS.
 */
const EXPLANATION_CHOICE_CRITERIA = {
  non_experiential: '自らが経験した知識ではない知識について記述された投稿',
  test_post: 'テスト投稿だとわかるもの',
  spam: 'スパム投稿',
  human_rights: '基本的人権を侵害する行為を奨励する投稿',
  illegal: '違法な行為を奨励する内容を含む投稿',
  welcomed:
    'ガイドラインに準拠した投稿。例外: 社会通念上望ましくなくても違法・人権侵害を奨励していない、または反省している場合は歓迎',
} as const;

const EXPLANATION_BY_CHOICE_KEY = {
  non_experiential: '自身の経験に基づかない知識が記述されています',
  test_post: 'テスト投稿です',
  spam: 'スパム投稿です',
  human_rights: '基本的人権を侵害する行為が奨励されています',
  illegal: '違法な行為を奨励する内容を含みます',
  welcomed: WELCOMED_EXPLANATION,
} as const satisfies Record<keyof typeof EXPLANATION_CHOICE_CRITERIA, (typeof GUIDELINE_EXPLANATIONS)[number]>;

type ExplanationChoiceKey = keyof typeof EXPLANATION_BY_CHOICE_KEY;

const IS_WELCOMED_INSTRUCTIONS = `投稿(title / contentHtml)が「歓迎される投稿」かどうかを判定してください。

歓迎されない条件:
- 自らが経験した知識ではない知識について記述された投稿
- 基本的人権を侵害する行為を奨励する投稿
- 違法な行為を奨励する内容を含む投稿
- テスト投稿だとわかるもの
- スパム投稿

例外（これらは歓迎される投稿）:
- 社会通念上望ましくない行為であっても、違法・基本的人権侵害を奨励していない
- 社会通念上望ましくない行為であっても、反省している
- 違法・人権侵害の表現があっても、奨励していない、または反省している`;

const EXPLANATION_INSTRUCTIONS = `歓迎判定の理由として最も適切なラベルを1つ選んでください。歓迎される投稿なら welcomed、歓迎されない場合は該当する非歓迎理由を選んでください。`;

type JevNoulAnswer = { type: 'noul'; noul: number };
type JevChoiceAnswer = {
  type: 'choice';
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};
type JevGuidelineResult = {
  answers?: {
    isWelcomed?: JevNoulAnswer;
    explanation?: JevChoiceAnswer;
  };
};

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

  const res = await fetch(CF_TURNSTILE_VERIFY_ENDPOINT, {
    method: 'POST',
    body: formData,
  });
  const outCome = (await res.json()) as { success: boolean };
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

function isExplanationChoiceKey(key: string): key is ExplanationChoiceKey {
  return Object.hasOwn(EXPLANATION_BY_CHOICE_KEY, key);
}

function mapJevAnswersToGuideline(result: JevGuidelineResult) {
  const noulAnswer = result.answers?.isWelcomed;
  const choiceAnswer = result.answers?.explanation;
  if (
    !noulAnswer ||
    noulAnswer.type !== 'noul' ||
    typeof noulAnswer.noul !== 'number' ||
    !choiceAnswer ||
    choiceAnswer.type !== 'choice' ||
    typeof choiceAnswer.choice !== 'string'
  ) {
    throw new Error('invalid_jev_response');
  }

  // noul is P(true); >= 0.5 → welcomed (see NOUL_TRUE_THRESHOLD).
  const isWelcomed = noulAnswer.noul >= NOUL_TRUE_THRESHOLD;

  if (!isExplanationChoiceKey(choiceAnswer.choice)) {
    throw new Error('invalid_jev_choice');
  }

  let explanation: (typeof GUIDELINE_EXPLANATIONS)[number] =
    EXPLANATION_BY_CHOICE_KEY[choiceAnswer.choice];

  // Keep DB/UI contract: isWelcomed true iff explanation is WELCOMED_EXPLANATION.
  if (isWelcomed) {
    explanation = WELCOMED_EXPLANATION;
  } else if (explanation === WELCOMED_EXPLANATION) {
    const probs = choiceAnswer.probabilities ?? {};
    const fallbackKey = (Object.keys(EXPLANATION_BY_CHOICE_KEY) as ExplanationChoiceKey[])
      .filter((key) => key !== 'welcomed')
      .sort((a, b) => (probs[b] ?? 0) - (probs[a] ?? 0))[0];
    explanation = EXPLANATION_BY_CHOICE_KEY[fallbackKey ?? 'test_post'];
  }

  return GUIDELINE_CHECK_SCHEMA.parse({ isWelcomed, explanation });
}

export async function getJudgeWelcomedByGenerativeAI(postContent: string, postTitle: string) {
  ensureSecurityInit();

  if (!_aiBinding) {
    console.warn('[security] AI binding not available, skipping guideline check');
    return { isWelcomed: true, explanation: WELCOMED_EXPLANATION };
  }

  try {
    // Workers AI: typesafe/jev — typed noul/choice answers, no freeform JSON.parse.
    // https://developers.cloudflare.com/ai/models/typesafe/jev/
    const result = (await (_aiBinding as unknown as {
      run: (model: string, input: unknown) => Promise<unknown>;
    }).run('typesafe/jev', {
      state: {
        title: postTitle,
        contentHtml: postContent,
      },
      questions: {
        isWelcomed: {
          type: 'noul',
          instructions: IS_WELCOMED_INSTRUCTIONS,
          criteria: {
            true: '歓迎される投稿（例外を含むガイドライン準拠）',
            false: '歓迎されない投稿（非経験知識・テスト・スパム・人権侵害奨励・違法行為奨励）',
          },
        },
        explanation: {
          type: 'choice',
          instructions: EXPLANATION_INSTRUCTIONS,
          criteria: { ...EXPLANATION_CHOICE_CRITERIA },
        },
      },
    })) as JevGuidelineResult;

    return mapJevAnswersToGuideline(result);
  } catch (error) {
    const errorKind =
      error instanceof z.ZodError
        ? 'invalid_schema'
        : error instanceof Error && error.message.startsWith('invalid_jev')
          ? error.message
          : 'ai_error';
    console.warn(
      `[security] AI guideline check failed (${errorKind}), defaulting to welcomed`,
    );
    return { isWelcomed: true, explanation: WELCOMED_EXPLANATION };
  }
}
