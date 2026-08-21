import { Turnstile } from '@marsidev/react-turnstile';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';

interface TurnstileModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteKey: string;
  onSuccess: (token: string) => boolean | void | Promise<boolean | void>;
  reloadOnSuccess?: boolean;
}

export function TurnstileModal({
  isOpen,
  onClose,
  siteKey,
  onSuccess,
  reloadOnSuccess = true,
}: TurnstileModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="しばらくお待ちください..."
      showCloseButton={false}
    >
      <Turnstile
        siteKey={siteKey}
        onSuccess={async (token) => {
          const isSuccess = await onSuccess(token);
          if (isSuccess === false) return;

          toast.success('再度アクションを実行してください。');
          onClose();
          if (reloadOnSuccess) window.location.reload();
        }}
        onError={() => {
          toast.error('時間をおいて再度お試しください。');
          onClose();
        }}
      />
    </Modal>
  );
}
