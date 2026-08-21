import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';
import type { StripeEmbeddedCheckout } from '@stripe/stripe-js';

interface SupportCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountYen: number;
  supporterName: string;
  supportMessage: string;
}


/**
 * サポートページの投げ銭決済をモーダル内に埋め込む（Stripe Embedded Checkout）。
 * 決済完了後は onComplete でリロードして、最新の支持メッセージを表示する。
 */
export function SupportCheckoutModal({
  isOpen,
  onClose,
  amountYen,
  supporterName,
  supportMessage,
}: SupportCheckoutModalProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      cancelledRef.current = false;
      setCheckoutStarted(false);
    }
  }, [isOpen]);

  const startCheckout = async () => {
    setCheckoutStarted(true);
    try {
      const formData = new FormData();
      formData.append('amountYen', String(amountYen));
      formData.append('supporterName', supporterName);
      formData.append('supportMessage', supportMessage);

      const res = await fetch('/api/stripe/support-checkout', { method: 'POST', body: formData });
      const data = (await res.json()) as {
        success?: boolean;
        clientSecret?: string;
        publishableKey?: string;
        message?: string;
      };

      if (cancelledRef.current) return;
      if (!data.success || !data.clientSecret || !data.publishableKey) {
        toast.error(data.message || '決済セッションを生成できませんでした');
        setCheckoutStarted(false);
        return;
      }

      const stripe = await loadStripe(data.publishableKey);
      if (!stripe) {
        toast.error('Stripeの初期化に失敗しました');
        setCheckoutStarted(false);
        return;
      }

      const checkout = await stripe.createEmbeddedCheckoutPage({
        clientSecret: data.clientSecret,
        onComplete: () => {
          if (cancelledRef.current) return;
          toast.success('ご支援ありがとうございます！反映まで数秒かかる場合があります');
          onClose();
          setTimeout(() => {
            if (!cancelledRef.current) window.location.reload();
          }, 1200);
        },
      });

      if (cancelledRef.current) return;
      checkoutRef.current = checkout;
      const container = mountRef.current;
      if (container) {
        container.replaceChildren();
        checkout.mount(container);
      }
    } catch (err) {
      console.error(err);
      if (!cancelledRef.current) {
        setCheckoutStarted(false);
        toast.error('決済セッションを生成できませんでした');
      }
    }
  };

  const handleClose = () => {
    cancelledRef.current = true;
    checkoutRef.current?.destroy();
    checkoutRef.current = null;
    setCheckoutStarted(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="サポートする" showCloseButton={false}>
      {!checkoutStarted ? (
        <div className="my-2">
          <p className="text-sm">
            <span className="font-bold">{supporterName}</span> さんとして ¥{amountYen.toLocaleString()}{' '}
            を送付します。
          </p>
          {supportMessage && <p className="text-sm mt-1">メッセージ: {supportMessage}</p>}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void startCheckout()}
              disabled={checkoutStarted}
            >
              決済に進む
            </button>
          </div>
        </div>
      ) : (
        <div ref={mountRef} />
      )}
    </Modal>
  );
}