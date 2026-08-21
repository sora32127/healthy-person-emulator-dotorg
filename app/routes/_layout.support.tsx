import type { MetaFunction } from 'react-router';
import { useLoaderData } from 'react-router';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { TurnstileModal } from '~/components/TurnstileModal';
import { H1 } from '~/components/Headings';
import { SupportCheckoutModal } from '~/components/SupportCheckoutModal';
import { getSupportMessages } from '~/modules/db.server';
import { getTurnStileSiteKey } from '~/modules/security.server';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export async function loader() {
  const [messages, CF_TURNSTILE_SITEKEY] = await Promise.all([
    getSupportMessages(),
    getTurnStileSiteKey(),
  ]);
  return { messages, CF_TURNSTILE_SITEKEY };
}

type LoaderData = {
  messages: Awaited<ReturnType<typeof getSupportMessages>>;
  CF_TURNSTILE_SITEKEY: string;
};

const NAME_MAX = 30;
const MESSAGE_MAX = 200;
const AMOUNT_MIN_YEN = 50;
const AMOUNT_MAX_YEN = 1_000_000;

export default function BeSponsor() {
  const { messages, CF_TURNSTILE_SITEKEY } = useLoaderData<typeof loader>() as LoaderData;

  const [supporterName, setSupporterName] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [amountYen, setAmountYen] = useState<number>(500);
  const [showModal, setShowModal] = useState(false);
  const [showTurnstileModal, setShowTurnstileModal] = useState(false);

  const total = messages.reduce((sum, m) => sum + m.amountYen, 0);
  const isFormValid =
    supporterName.trim().length > 0 &&
    supporterName.trim().length <= NAME_MAX &&
    supportMessage.length <= MESSAGE_MAX &&
    Number.isInteger(amountYen) &&
    amountYen >= AMOUNT_MIN_YEN &&
    amountYen <= AMOUNT_MAX_YEN;

  // Turnstile検証成功後、isValidUser セッションを立てて決済確認画面へ戻す
  const handleTurnstileSuccess = async (token: string) => {
    const formData = new FormData();
    formData.append('token', token);
    try {
      const response = await fetch('/api/turnstile-verify', { method: 'POST', body: formData });
      const data = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !data.success) {
        toast.error(data.message || 'ユーザー認証に失敗しました');
        return false;
      }

      setShowTurnstileModal(false);
      setShowModal(true);
      return true;
    } catch {
      toast.error('ユーザー認証に失敗しました');
      return false;
    }
  };

  return (
    <div>
      <H1>サポートする</H1>

      {/* フォームを履歴より上に */}
      <form
        className="w-full my-8 flex flex-col gap-4"
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
            className="input input-bordered w-full"
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
            className="textarea textarea-bordered w-full"
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
            min={AMOUNT_MIN_YEN}
            max={AMOUNT_MAX_YEN}
            step={1}
            value={amountYen}
            onChange={(e) => setAmountYen(Number(e.target.value))}
            className="input input-bordered w-full"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block mt-2" disabled={!isFormValid}>
          応援する
        </button>
        {!isFormValid && (
          <p className="text-error text-sm">
            お名前を入力し、金額を50円以上1,000,000円以下の整数にしてください。
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
            {messages.map((m) => (
              <div
                key={`${m.supporterName}-${m.paidAtUtc.toISOString()}`}
                className="bg-base-100 p-4 mb-4"
              >
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary text-sm">
                    ¥{m.amountYen.toLocaleString()}
                  </span>
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
        onRequireTurnstile={() => {
          setShowModal(false);
          setShowTurnstileModal(true);
        }}
      />

      <TurnstileModal
        isOpen={showTurnstileModal}
        onClose={() => setShowTurnstileModal(false)}
        siteKey={CF_TURNSTILE_SITEKEY}
        onSuccess={handleTurnstileSuccess}
        reloadOnSuccess={false}
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
