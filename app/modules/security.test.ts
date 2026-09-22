import { getJudgeWelcomedByGenerativeAI, initSecurity, validateRequest } from './security.server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const WELCOMED_RESULT = {
  isWelcomed: true,
  explanation: 'ガイドラインに準拠した投稿です',
};

function jevAnswers(opts: {
  noul: number;
  choice: string;
  probabilities?: Record<string, number>;
}) {
  return {
    model: 'jev-1.13.0',
    answers: {
      isWelcomed: { type: 'noul' as const, noul: opts.noul },
      explanation: {
        type: 'choice' as const,
        choice: opts.choice,
        confidence: 0.9,
        probabilities: opts.probabilities,
      },
    },
  };
}

function initWithAI(response?: unknown) {
  const run =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response);
  initSecurity({
    CF_TURNSTILE_SECRET_KEY: 'test',
    CF_TURNSTILE_SITEKEY: 'test',
    AI: (response === undefined ? undefined : { run }) as unknown as Ai,
  });
  return run;
}

describe('security.server', () => {
  beforeAll(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.unstubAllGlobals());
  afterAll(() => vi.restoreAllMocks());

  it('Turnstileの秘密情報をログ出力しない', async () => {
    initWithAI();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(validateRequest('turnstile-token', '192.0.2.1')).resolves.toBe(true);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('typesafe/jev の noul/choice で非歓迎判定する', async () => {
    const result = {
      isWelcomed: false,
      explanation: '自身の経験に基づかない知識が記述されています',
    };
    const run = initWithAI(
      jevAnswers({
        noul: 0.12,
        choice: 'non_experiential',
        probabilities: {
          non_experiential: 0.8,
          welcomed: 0.1,
          test_post: 0.05,
          spam: 0.05,
          human_rights: 0,
          illegal: 0,
        },
      }),
    );

    await expect(getJudgeWelcomedByGenerativeAI(testPostHtml, '知識投稿')).resolves.toEqual(result);
    expect(run).toHaveBeenCalledWith(
      'typesafe/jev',
      expect.objectContaining({
        state: expect.objectContaining({
          title: '知識投稿',
          contentHtml: testPostHtml,
        }),
        questions: expect.objectContaining({
          isWelcomed: expect.objectContaining({ type: 'noul' }),
          explanation: expect.objectContaining({ type: 'choice' }),
        }),
      }),
    );
  });

  it('typesafe/jev の object 応答で歓迎判定する（回帰: JSON.parse不要）', async () => {
    const run = initWithAI(jevAnswers({ noul: 0.91, choice: 'welcomed' }));

    await expect(getJudgeWelcomedByGenerativeAI(testPostHtml, '投稿')).resolves.toEqual(
      WELCOMED_RESULT,
    );
    expect(run).toHaveBeenCalledWith('typesafe/jev', expect.any(Object));
  });

  it('noul>=0.5 なら choice が非歓迎でも歓迎に揃える', async () => {
    initWithAI(jevAnswers({ noul: 0.55, choice: 'spam' }));
    await expect(getJudgeWelcomedByGenerativeAI(testPostHtml, '投稿')).resolves.toEqual(
      WELCOMED_RESULT,
    );
  });

  it('noul<0.5 で choice が welcomed のとき確率から非歓迎理由を選ぶ', async () => {
    initWithAI(
      jevAnswers({
        noul: 0.2,
        choice: 'welcomed',
        probabilities: {
          welcomed: 0.4,
          test_post: 0.35,
          spam: 0.2,
          non_experiential: 0.05,
          human_rights: 0,
          illegal: 0,
        },
      }),
    );
    await expect(getJudgeWelcomedByGenerativeAI(testPostHtml, '投稿')).resolves.toEqual({
      isWelcomed: false,
      explanation: 'テスト投稿です',
    });
  });

  it.each([
    ['AI bindingなし', undefined],
    ['AI呼び出し失敗', new Error('AI unavailable')],
    ['answers欠落', { model: 'jev-1.13.0' }],
    ['不正な choice キー', jevAnswers({ noul: 0.1, choice: 'unknown_reason' })],
    ['noul 型不正', { answers: { isWelcomed: { type: 'noul', noul: 'yes' }, explanation: { type: 'choice', choice: 'spam' } } }],
  ])('%sの応答は歓迎として扱う（fail-open）', async (_name, response) => {
    initWithAI(response);
    await expect(getJudgeWelcomedByGenerativeAI(testPostHtml, '投稿')).resolves.toEqual(
      WELCOMED_RESULT,
    );
  });
});

const testPostHtml = `
<h3>5W1H+Then状況説明</h3>
<table><tbody>
  <tr><td>Who(誰が)</td><td>テストユーザーが</td></tr>
  <tr><td>When(いつ)</td><td>昨日</td></tr>
  <tr><td>Where(どこで)</td><td>公園で</td></tr>
  <tr><td>Why(なぜ)</td><td>面白そうだったから</td></tr>
  <tr><td>What(何を)</td><td>友人に</td></tr>
  <tr><td>How(どのように)</td><td>冗談を言った</td></tr>
  <tr><td>Then(どうした)</td><td>空気が悪くなった</td></tr>
</tbody></table>

<h3>
  健常行動ブレイクポイント
</h3>
<ul>
  <li>相手の気持ちを考えていなかった</li>
</ul>
<h3>
  どうすればよかったか
</h3>
<ul>
  <li>黙っているべきだった</li>
</ul>
`;
