import type { MetaFunction } from '@remix-run/node';
import { NavLink } from '@remix-run/react';
import { H1 } from '~/components/Headings';
import fanboxQRCode from '~/src/assets/fanbox_qr_code.png';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export default function BeSponsor() {
    return (
        <div className='text-center'>
          <H1>サポートする</H1>
          <p>健常者と非健常者の境目は存在しません。時と場合次第で、誰もが健常者となり、誰もが非健常者となります。</p>
          <p>そんな世界の中で、誰もが暗黙知にアクセスでき、投稿でき、評価できる「プラットフォーム」を作るのが、健常者エミュレータ事例集が存在する目的です。健常者エミュレータ事例集は、個人の属性に寄らず、暗黙知を必要とするすべての人のために存在しています。</p>
          <p>暗黙知を共有できる場所を作るためには、サーバー代をはじめとしたある程度の金銭が必要です。現在、健常者エミュレータ事例集の運営には以下のコストがかかっています。</p>
          <br/>
          <ul className="list-disc list-inside text-center">
            <li><a href="https://supabase.com/pricing" className='text-info underline underline-offset-4'>Supabase Pro Plan</a>: $25/月</li>
            <li><a href="https://vercel.com/pricing" className='text-info underline underline-offset-4'>Vercel Pro Plan</a> : $20/月</li>
            <li>ドメイン代(Cloudflare) : $10.11/年</li>
          </ul>
          <br/>
          <p>もし健常者エミュレータ事例集の理念に共感していただけるのなら、以下のPixiv Fanboxから寄付していただけると助かります。</p>
          <a href="https://contradiction29.fanbox.cc/"
            className="btn-primary font-bold py-2 px-8 rounded-md block w-full mt-8">サポートする
          </a>
          <div className="text-center mt-6">
            <p>以下のQRコードから支払うことも可能です。</p>
            <img src={fanboxQRCode} alt="Stripe QR Code" className="mx-auto md:h-96 mt-6" />
          </div>
        </div>
    );
}

export const meta: MetaFunction = () => {
  const commonMeta = commonMetaFunction({
    title : "サポートする",
    description : "健常者エミュレータ事例集をサポートしよう",
    url: "https://healthy-person-emulator.org/support",
    image: null
  });
  return commonMeta;
};