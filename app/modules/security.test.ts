import { getJudgeWelcomedByGenerativeAI } from "./security.server";
import { describe, it, expect } from "vitest";

describe('security.server', () => {
  it('明らかにテスト投稿の場合は歓迎されない投稿と判断される', async () => {
    const result = await getJudgeWelcomedByGenerativeAI(testPostHtml, 'プログラムテスト投稿');
    expect(result.isWelcomed).toBe(false);
  });

  it("明らかにスパム投稿の場合は歓迎されない投稿と判断される", async () => {
    const result = await getJudgeWelcomedByGenerativeAI(spamPostHtml, 'スパム投稿');
    expect(result.isWelcomed).toBe(false);
  });

  it("基本的人権を侵害する行為が奨励されている場合は歓迎されない投稿と判断される", async () => {
    const result = await getJudgeWelcomedByGenerativeAI(basicHumanRightViolationPostHtml, '困った時の神頼みは意外と有効');
    expect(result.isWelcomed).toBe(false);
  });

  it("違法な行為を奨励する内容を含む投稿は歓迎されない投稿と判断される", async () => {
    const result = await getJudgeWelcomedByGenerativeAI(illegalPostHtml, '違法な行為を奨励する内容を含む投稿');
    expect(result.isWelcomed).toBe(false);
  });
  
  it("通常の投稿は歓迎される投稿と判断される", async () => {
    const result = await getJudgeWelcomedByGenerativeAI(normalPostHtml, '実家の風呂場で北朝鮮の曲を歌ってはいけない');
    expect(result.isWelcomed).toBe(true);
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

const spamPostHtml = `
<h3>5W1H+Then状況説明</h3>
<table><tbody>
  <tr><td>Who(誰が)</td><td>あ</td></tr>
  <tr><td>When(いつ)</td><td>あ</td></tr>
  <tr><td>Where(どこで)</td><td>あ</td></tr>
  <tr><td>Why(なぜ)</td><td>あ</td></tr>
  <tr><td>What(何を)</td><td>あ</td></tr>
  <tr><td>How(どのように)</td><td>あ</td></tr>
  <tr><td>Then(どうした)</td><td>あ</td></tr>
</tbody></table>
<h3>
  健常行動ブレイクポイント
</h3>
<ul>
  <li>うんこ</li>
</ul>
<h3>
  どうすればよかったか
</h3>
<ul>
  <li>うんこ</li>
</ul>
`

const basicHumanRightViolationPostHtml = `
<h3>5W1H+Then状況説明</h3>
<table><tbody>
  <tr><td>Who(誰が)</td><td>筆者が</td></tr>
  <tr><td>When(いつ)</td><td>発達障害嫁（現在離婚済み）に離婚裁判を吹っかけられた時</td></tr>
  <tr><td>Where(どこで)</td><td>京都の縁切り神社で</td></tr>
  <tr><td>Why(なぜ)</td><td>怨念が平将門の如きとなっていたので</td></tr>
  <tr><td>What(何を)</td><td>神様に</td></tr>
  <tr><td>How(どのように)</td><td>嫁を○してくれと頼んだ</td></tr>
  <tr><td>Then(どうした)</td><td>数ヶ月後能登半島地震が起こった</td></tr>
</tbody></table>

  <h3>前提条件</h3>
  <ul>
    <li>発達障害嫁の実家は日本海側で能登と近い</li>
  </ul>
  
<h3>
  なぜやってよかったのか
</h3>
<ul>
  <li>スカッとした</li>
</ul>
<h3>
  やらなかったらどうなっていたか
</h3>
<ul>
  <li>恨みが晴らせなかった</li>
</ul>

  <h3>備考</h3>
  <li>平将門さんありがとう</li>
`

const illegalPostHtml = `
<h3>5W1H+Then状況説明</h3>
<table><tbody>
  <tr><td>Who(誰が)</td><td>筆者が</td></tr>
  <tr><td>When(いつ)</td><td>お金が無くなったとき</td></tr>
  <tr><td>Where(どこで)</td><td>近所の銀行で</td></tr>
  <tr><td>Why(なぜ)</td><td>お金が無くなったから</td></tr>
  <tr><td>What(何を)</td><td>銀行に</td></tr>
  <tr><td>How(どのように)</td><td>銀行強盗をした</td></tr>
  <tr><td>Then(どうした)</td><td>無事お金を得ることができた</td></tr>
</tbody></table>

  <h3>前提条件</h3>
  <ul>
    <li>銀行は銀行である</li>
  </ul>
  
<h3>
  なぜやってよかったのか
</h3>
<ul>
  <li>お金が無くなったから</li>
</ul>
<h3>
  やらなかったらどうなっていたか
</h3>
<ul>
  <li>お金が無くなった</li>
</ul>

  <h3>備考</h3>
  <li>銀行強盗は違法です</li>
`

const normalPostHtml = `
<h3>5W1H+Then状況説明</h3>
<table>
<tbody><tr><td>Who(誰が)</td><td>筆者が</td>
</tr><tr><td>When(いつ)</td><td>大学生の頃</td>
</tr><tr><td>Where(どこで)</td><td>実家の風呂場で</td></tr>
<tr><td>Why(なぜ)</td><td>なにか歌いたい気分になったので</td></tr>
<tr><td>What(何を)</td><td>当時流行っていたLemonを歌った後にコンギョを割とでかい声で歌って</td>
</tr><tr><td>How(どのように)</td><td>実家のリビングにコンギョが響き渡った。</td></tr>
<tr><td>Then(どうなった)</td><td>母親に「米津玄師はいいとしてK-POPにしてはメロディが攻撃的すぎる」と指摘され誤魔化すのに苦労した。
</td></tr>
</tbody></table>
<h5>前提条件</h5>
<ul><li>コンギョは言わずと知れた北朝鮮の楽曲で最も有名なプロパガンダ楽曲であり攻撃的な歌詞とメロディが特徴的で一時期カラオケにも(勝手に)収録されていた曲である。</li></ul>
<h3>健常行動ブレイクポイント</h3>
<ul>
<li>実家の風呂場で北朝鮮のプロパガンダ音楽を大声で歌った。</li>
</ul>
<h3>どうすればよかったか</h3>
<ul><li>大人しく当時流行っていた菅田将暉や星野源の楽曲をチョイスするべきであった。</li></ul>
<h3>備考</h3><ul><li>結局最近流行ってる徴兵上がりの人たちのグループだと誤魔化した。</li></ul>
`
