import { redirect } from '@remix-run/node';
import { loadStripe } from '@stripe/stripe-js';
import { H1 } from '~/components/Headings';

export default function BeSponsor() {
    const handleClick = async () => {
        const stripe = await loadStripe('pk_live_51KZ7kGC6caL01x3D3TiKzBFOwOzrtBaG0P4NakYB95JUqUZcu7mY8eljGBYMMrJWxRt4zKRsCO83LFt6LcdVs3Js000rTp5ssx');
        if (!stripe) {
            return redirect('/');
        }
        const { error } = await stripe.redirectToCheckout({
          lineItems: [{
            price: 'price_1P1SLBC6caL01x3DC06xBwkP',
            quantity: 1,
          }],
          mode: 'payment',
          successUrl: 'https://healthy-person-emulator-dotorg.vercel.app/success',
          cancelUrl: 'https://healthy-person-emulator-dotorg.vercel.app/',
        });
        if (error) {
          return redirect('/');
        }
      };
    return (
        <div className="max-w-2xl mx-auto">
          <H1>サポートする</H1>
          <p className="text-xl mt-8">
            健常者エミュレータ事例集は、誰もが暗黙知にアクセスできる社会を実現するプロジェクトです。
            私たちは、一人でも多くの人々に知識を届け、より良い社会の実現に貢献したいと考えています。
          </p>
          <p className="text-xl mt-4">
            しかし、このプロジェクトを維持・発展させるためには、皆様のサポートが不可欠です。
            もしこのプロジェクトに共感していただけるなら、ぜひ支援をご検討ください。
          </p>
          <p className="text-xl mt-4">
            以下のボタンから、わずか500円で私たちのサポーターになることができます。
            あなたの支援が、より多くの人々に知識を届ける原動力となります。
          </p>
          <button
            role="link"
            onClick={handleClick}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full w-full mt-8 text-2xl"
          >
            500円でサポートする
          </button>
        </div>
    );
}