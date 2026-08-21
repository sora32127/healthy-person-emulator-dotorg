import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useLoaderData } from 'react-router';
import { useState } from 'react';
import { H1 } from '~/components/Headings';
import { SupportCheckoutModal } from '~/components/SupportCheckoutModal';
import { getSupportMessages } from '~/modules/db.server';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export async function loader({}: LoaderFunctionArgs) {
  const messages = await getSupportMessages();
  return { messages };
}

type LoaderData = {
  messages: Awaited<ReturnType<typeof getSupportMessages>>;
};

const NAME_MAX = 30;
const MESSAGE_MAX = 200;

export default function BeSponsor() {
  const { messages } = useLoaderData<typeof loader>() as LoaderData;

  const [supporterName, setSupporterName] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [amountYen, setAmountYen] = useState<number>(500);
  const [showModal, setShowModal] = useState(false);

  const total = messages.reduce((sum, m) => sum + m.amountYen, 0);
  const isFormValid =
    supporterName.trim().length > 0 &&
    supporterName.trim().length <= NAME_MAX &&
    supportMessage.length <= MESSAGE_MAX &&
    Number.isInteger(amountYen) &&
    amountYen >= 100;

  return (
    <div>
      <H1>サポートする</H1>

      {/* フォームを履歴より上に */}
      <form
        className="my-8 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (isFormValid) setShowModal(true);
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="support-name" className="font-medium">
            お名前（公開されます）
          </label>
          <input
            id="support-name"
            type="text"
            value={supporterName}
            maxLength={NAME_MAX}
            onChange={(e) => setSupporterName(e.target.value)}
            placeholder="例: 匿名応援者"
            className="input input-bordered"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="support-message" className="font-medium">
            応援メッセージ（任意）
          </label>
          <textarea
            id="support-message"
            value={supportMessage}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setSupportMessage(e.target.value)}
            placeholder="健常者エミュレータ事例集を応援しています！"
            className="textarea textarea-bordered"
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="support-amount" className="font-medium">
            応援金額（円）
          </label>
          <input
            id="support-amount"
            type="number"
            min={100}
            step={100}
            value={amountYen}
            onChange={(e) => setAmountYen(Number(e.target.value))}
            className="input input-bordered"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block mt-2" disabled={!isFormValid}>
          応援する
        </button>
        {!isFormValid && (
          <p className="text-error text-sm">
            お名前を入力し、金額を{amountYen < 100 ? '100円以上' : '整数'}にしてください。
          </p>
        )}
      </form>

      <hr className="my-8" />

      <section className="mt-8">
        <p className="font-bold">応援メッセージ（累計 ¥{total.toLocaleString()}）</p>
        {messages.length === 0 ? (
          <p className="my-4">まだ応援メッセージはありません。初めての応援をぜひお願いします。</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {messages.map((m, i) => (
              <div key={i} className="bg-base-100 p-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary text-sm">¥{m.amountYen.toLocaleString()}</span>
                  <p className="font-bold">{m.supporterName} さん</p>
                </div>
                {m.supportMessage && (
                  <p className="whitespace-pre-wrap break-words mt-1">{m.supportMessage}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <SupportCheckoutModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        amountYen={amountYen}
        supporterName={supporterName.trim()}
        supportMessage={supportMessage.trim()}
      />
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