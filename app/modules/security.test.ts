import { getJudgeWelcomedByGenerativeAI } from "./security.server";
import { describe, it, expect } from "vitest";

describe('security.server', () => {
  it('明らかにテスト投稿の場合は歓迎されない投稿と判断される', async () => {
    const result = await getJudgeWelcomedByGenerativeAI(testPostHtml, 'プログラムテスト投稿');
    console.log(result);
    expect(result.isWelcomed).toBe(false);
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
`
