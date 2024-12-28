import { Turnstile } from "@marsidev/react-turnstile";
import { Modal } from "./Modal";

interface TurnstileModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteKey: string;
  onSuccess: (token: string) => void;
}

export function TurnstileModal({ isOpen, onClose, siteKey, onSuccess }: TurnstileModalProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="しばらくお待ちください..." showCloseButton={false}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={(token) => {
          onSuccess(token);
          onClose();
        }}
        onError={() => {
          onClose();
        }}
      />
    </Modal>
  );
}