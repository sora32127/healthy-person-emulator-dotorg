import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';

interface ClearLocalStorageButtonProps {
  clearInputs: () => void;
}

const ClearLocalStorageButton = ({ clearInputs }: ClearLocalStorageButtonProps) => {
  const [showModal, setShowModal] = useState(false);

  const handleClearLocalStorage = () => {
    clearInputs();
    setShowModal(false);
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShowModal(true)}>
        入力をクリア
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>確認</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>入力内容をクリアしますか？</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            いいえ
          </Button>
          <Button variant="primary" onClick={handleClearLocalStorage}>
            はい
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ClearLocalStorageButton;