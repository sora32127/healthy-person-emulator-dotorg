import { Turnstile } from '@marsidev/react-turnstile';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';

interface TurnstileModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteKey: string;
  onSuccess: (token: string) => void;
}

export function TurnstileModal({
  isOpen,
  onClose,
  siteKey,
  onSuccess,
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
        onSuccess={(token) => {
          toast.success('再度アクションを実行してください。');
          onSuccess(token);
          onClose();
          window.location.reload();
        }}
        onError={() => {
          toast.error('時間をおいて再度お試しください。');
          onClose();
        }}
      />
    </Modal>
  );
}
