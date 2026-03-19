import type { MetaFunction } from 'react-router';
import { H1 } from '~/components/Headings';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export default function BeSponsor() {
  return (
    <div>
      <H1>サポートする</H1>
      <p>
        健常者と非健常者の境目は存在しません。時と場合次第で、誰もが健常者となり、誰もが非健常者となります。
      </p>
      <p>
        そんな世界の中で、誰もが暗黙知にアクセスでき、投稿でき、評価できる「プラットフォーム」を作るのが、健常者エミュレータ事例集が存在する目的です。健常者エミュレータ事例集は、個人の属性に寄らず、暗黙知を必要とするすべての人のために存在しています。
      </p>
      <p>
        暗黙知を共有できる場所を作るためには、サーバー代をはじめとしたある程度の金銭が必要です。もし健常者エミュレータ事例集の理念に共感していただけるのなら、サポートしていただけると助かります。
      </p>
      <br />
      <p>サポートの詳細については、以下のページをご覧ください。</p>
      <a
        href="https://contradictiononline.org/entry/2026/03/17/161448/"
        className="btn-primary font-bold py-2 px-8 rounded-md block w-full mt-8 text-center"
        target="_blank"
        rel="noopener noreferrer"
      >
        サポートについて詳しく見る
      </a>
    </div>
  );
}

export const meta: MetaFunction = () => {
  const commonMeta = commonMetaFunction({
    title: 'サポートする',
    description: '健常者エミュレータ事例集をサポートしよう',
    url: 'https://healthy-person-emulator.org/support',
    image: null,
  });
  return commonMeta;
};
