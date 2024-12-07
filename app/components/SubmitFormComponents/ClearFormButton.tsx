import { useState } from 'react';
import { Modal } from "../Modal";

interface ClearFormButtonProps {
  clearInputs: () => void;
}

export default function ClearFormButton({ clearInputs }: ClearFormButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClearLocalStorage = () => {
    clearInputs();
    setShowModal(false);
  };

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setShowModal(true)}>入力内容をリセット</button>
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="入力内容をリセット"
        showCloseButton={false}
      >
        <p>入力内容をリセットしますか？</p>
        <div className="modal-action flex justify-between">
          <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>戻る</button>
          <button type="button" className="btn btn-warning" onClick={handleClearLocalStorage}>リセットする</button>
        </div>
      </Modal>
    </>
  );
}
