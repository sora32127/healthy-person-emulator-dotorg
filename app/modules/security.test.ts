import { getJudgeWelcomedByGenerativeAI, initSecurity } from './security.server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const WELCOMED_RESULT = {
  isWelcomed: true,
  explanation: 'ガイドラインに準拠した投稿です',
};

function initWithAI(response?: unknown) {
  const run =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue({
          response: typeof response === 'string' ? response : JSON.stringify(response),
        });
  initSecurity({
    CF_TURNSTILE_SECRET_KEY: 'test',
    CF_TURNSTILE_SITEKEY: 'test',
    AI: (response === undefined ? undefined : { run }) as unknown as Ai,
  });
  return run;
}

describe('security.server', () => {
  beforeAll(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterAll(() => vi.restoreAllMocks());

  it('Mistralの構造化出力で非歓迎判定する', async () => {
    const result = {
      isWelcomed: false,
      explanation: '自身の経験に基づかない知識が記述されています',
    };
    const run = initWithAI(result);

    await expect(getJudgeWelcomedByGenerativeAI(testPostHtml, '知識投稿')).resolves.toEqual(result);
    expect(run).toHaveBeenCalledWith(
      '@cf/mistralai/mistral-small-3.1-24b-instruct',
      expect.objectContaining({
        temperature: 0,
        max_tokens: 128,
        guided_json: expect.objectContaining({ additionalProperties: false }),
      }),
    );
    const input = JSON.stringify(run.mock.calls[0]?.[1]);
    expect(input).toContain(result.explanation);
    expect(input).toContain('isWelcomedがtrueの場合');
  });

  it.each([
    ['AI bindingなし', undefined],
    ['JSONではない', 'not json'],
    ['boolean型が不正', { ...WELCOMED_RESULT, isWelcomed: 'true' }],
    ['未知の理由', { isWelcomed: false, explanation: '未知の理由' }],
    ['trueと理由が矛盾', { isWelcomed: true, explanation: 'テスト投稿です' }],
    ['falseと理由が矛盾', { isWelcomed: false, explanation: WELCOMED_RESULT.explanation }],
    ['余分なキー付き', { ...WELCOMED_RESULT, extra: true }],
    ['AI呼び出し失敗', new Error('AI unavailable')],
  ])('%sの応答は歓迎として扱う', async (_name, response) => {
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
