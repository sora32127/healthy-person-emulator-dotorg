import { NavLink } from '@remix-run/react';
import stripeQRCode from '~/src/assets/stripe_qr_code.png';

export default function BeSponsor() {
    return (
        <div>
          <h1 className='text-center my-5'>サポートする</h1>
          <p>
            健常者エミュレータ事例集は、誰もが暗黙知にアクセスできる社会を実現するプロジェクトです。
            私たちは、一人でも多くの人々に知識を届け、より良い社会の実現に貢献したいと考えています。
          </p>
          <p>
            しかし、このプロジェクトを維持・発展させるためには、皆様のサポートが不可欠です。
            もしこのプロジェクトに共感していただけるなら、ぜひ支援をご検討ください。
          </p>
          <p>
            以下のボタンから、500円で私たちのサポーターになることができます。
            あなたの支援が、より多くの人々に知識を届ける原動力となります。
          </p>
          <button className="mt-8 w-full">
            <NavLink to ="https://buy.stripe.com/8wM3cG2Diemj5Qk5kk"
              role="link"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded-md block w-full">サポートする
            </NavLink>
          </button>
          <div className="text-center mt-6">
            <p>以下のQRコードから支払うことも可能です。</p>
            <img src={stripeQRCode} alt="Stripe QR Code" className="mx-auto md:h-96 mt-6" />
          </div>
        </div>
    );
}