import { NavLink, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import ReactMarkdown from 'react-markdown';
import { H1, H2, H3 } from '~/components/Headings';
import { commonMetaFunction } from '~/utils/commonMetafunction';
import { drizzle } from 'drizzle-orm/d1';
import { asc } from 'drizzle-orm';
import { dimFaqItems } from '~/drizzle/schema';

// FAQデータの型定義
interface FAQItem {
  question: string;
  answer: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const env = (globalThis as any).__cloudflareEnv;
  const db = drizzle(env.DB);

  const faqs = await db
    .select({
      question: dimFaqItems.question,
      answer: dimFaqItems.answer,
    })
    .from(dimFaqItems)
    .orderBy(asc(dimFaqItems.displayOrder));

  return { faqs };
}


// FAQアイテムコンポーネント
function FAQItem({ faq, isLast }: { faq: FAQItem; isLast: boolean }) {
  return (
    <div>
      <ul>
        <li>
          <ReactMarkdown>{`Q: ${faq.question}`}</ReactMarkdown>
        </li>
        <li>
          <ReactMarkdown>{`A: ${faq.answer}`}</ReactMarkdown>
        </li>
      </ul>
      {!isLast && <hr className="my-6 border-base-300" />}
    </div>
  );
}

// FAQセクションコンポーネント
function FAQSection({ faqs }: { faqs: FAQItem[] }) {
  return (
    <div>
      <H2>よくある質問</H2>
      {faqs.length === 0 ? (
        <p>現在よくある質問は登録されていません。</p>
      ) : (
        faqs.map((faq, index) => (
          <FAQItem key={index} faq={faq} isLast={index === faqs.length - 1} />
        ))
      )}
    </div>
  );
}

export default function Component() {
  const { faqs } = useLoaderData<typeof loader>();
  return (
    <div className="postContent">
      <H1>サイト説明</H1>
      <H2>健常者エミュレータ事例集とは</H2>
      <ul>
        <li>
          このサイトは、現実世界に存在する暗黙の知識を集積することで、知識のギャップを解消し、ユーザー全体でよりよい生活を築いていくために生まれました
        </li>
        <li>
          暗黙の知識を言語化して集積し、健常者エミュレータを動作させ、現実世界を生きる糧とするのが目的です
        </li>
        <li>
          健常者エミュレータが何なのかは
          <a href="https://contradiction29.hatenablog.com/entry/2021/06/30/210154">
            管理人が書いた文章
          </a>
          を参照してください
        </li>
        <li>
          問い合わせは管理人
          <a href="https://x.com/messages/compose?recipient_id=1249916069344473088">
            @contradiction29のXのDM
          </a>
          までお願いします
        </li>
      </ul>
      <H2>ユーザーガイドライン</H2>
      <p>
        健常者エミュレータ事例集に対して、記事やコメントの投稿、記事の編集を行うユーザーに対しては、以下のガイドラインに則って行動することが求められます。
      </p>
      <H3>新規記事の投稿について</H3>
      <ul>
        <li>
          誰もが新規ページを作成することが可能です。我々は集合体として、健常者エミュレータを完成させるための個別事例を強く欲しています。ぜひあなたの経験を投稿してください。
        </li>
        <li>
          以下の要素を含む投稿を行ってはいけません。
          <ul>
            <li>基本的人権の否定や、誹謗中傷、暴言、プライバシー違反を含む投稿</li>
            <li>経験知の集積そのものを否定する行為</li>
            <li>荒らし行為に該当する投稿</li>
            <li>
              経験談ではない記事を投稿すること。自分の経験であるか他人の経験であるかは問わない
            </li>
            <li>幼児的かつ性的な表現</li>
          </ul>
        </li>
        <li>
          健常者エミュレータ事例集の理念にそぐわないと判断される場合、管理人の裁量に基づき、ページが削除されることがあります。
        </li>
        <li>悪質な投稿を行った場合、管理人の裁量に基づき、アクセスを遮断することがあります。</li>
        <li>
          ページ作成時は、以下の方針にのっとり記事を作成することを推奨します。
          <ul>
            <li>暗黙の前提を明らかにする</li>
            <li>経験値を共有する</li>
            <li>基本的人権を侵害しない</li>
          </ul>
        </li>
        <li>
          テンプレートに沿って投稿を行う場合、
          <NavLink to="/post">投稿フォーム</NavLink>を利用してください
        </li>
      </ul>
      <H3>コメントの投稿について</H3>
      <ul>
        <li>コメント投稿時のガイドラインは、投稿時のガイドラインに準ずるものとします</li>
      </ul>
      <H3>記事の編集について</H3>
      <ul>
        <li>
          記事を編集するためには<NavLink to="/signup">ユーザー登録</NavLink>
          および<NavLink to="/login">ログイン</NavLink>が必要です
        </li>
        <li>編集内容に議論がある場合、コメントで議論を行ってから編集をしてください</li>
        <li>
          自分の主張を裏付けるための編集、荒らし、白紙化を行った場合はガイドライン違反とみなし、ユーザーが無効化されることがあります。
        </li>
      </ul>
      <H2>Discordコミュニティについて</H2>
      <ul>
        <li>
          <a href="https://t.co/SOg8HEB1Ga">Discordの招待リンク</a>
          から入ることが可能です。判断に迷った場合や、議論したいことがある場合などに使ってください。
        </li>
        <li>
          このサーバーでは、おすすめの記事を紹介しあったり、どのように行動するべきか議論が行われたりしています。
        </li>
      </ul>
      <H2>SNS連携について</H2>
      <ul>
        <li>
          健常者エミュレータ事例集に投稿された記事は、以下の経路でSNSにも自動投稿されます
          <ul>
            <li>
              <a href="https://x.com/helthypersonemu">X</a>
            </li>
            <li>
              <a href="https://bsky.app/profile/helthypersonemu.bsky.social">Bluesky</a>
            </li>
            <li>
              <a href="https://misskey.io/@helthypersonemu">Misskey.io(ActivityPub対応版)</a>
            </li>
          </ul>
        </li>
        <li>SNSに投稿される際は、5W1H+Then状況説明の箇所が画像として表示されます</li>
        <li>10分に一回の頻度で更新されます</li>
      </ul>

      <H2>AIエージェント・外部からの利用</H2>
      <ul>
        <li>
          投稿の検索・取得には公開JSON APIを利用できます。詳細は
          <NavLink to="/api-docs">公開API仕様</NavLink>を参照してください。
        </li>
        <li>
          機械可読なOpenAPI 3.1.0仕様は <code>/api/openapi.json</code> で取得できます。
        </li>
      </ul>

      <H2>開発について</H2>
      <ul>
        <li>健常者エミュレータ事例集のコードは、GPL-3.0ライセンスの元公開されています。</li>
        <li>
          コードの改善やバグ修正の提案がある場合は、
          <a href="https://discord.com/invite/sQehNGTnSg">Discord</a>
          の「#エンジニアリング議論」チャンネル、または管理人の
          <a href="https://x.com/messages/compose?recipient_id=1249916069344473088">XのDM</a>
          までご連絡ください。提案の検討・実装は管理人が行います。
        </li>
        <li>
          詳細は
          <a href="https://github.com/sora32127/healthy-person-emulator-dotorg">GitHub</a>
          をご覧ください
        </li>
      </ul>

      <FAQSection faqs={faqs} />
    </div>
  );
}

export const meta: MetaFunction = () => {
  const commonMeta = commonMetaFunction({
    title: 'サイト説明',
    description: 'サイトの趣旨の説明',
    url: 'https://healthy-person-emulator.org/readme',
    image: null,
  });
  return commonMeta;
};
