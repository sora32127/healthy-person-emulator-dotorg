import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Turnstile } from '@marsidev/react-turnstile'

const VITE_CF_TURNSTILE_SITEKEY = import.meta.env.VITE_CF_TURNSTILE_SITEKEY;

interface SubmitContentBoxProps {
  situationValues: { [key: string]: string };
  assumptionValues: string[];
  reflectionValues: string[];
  counterFactualReflectionValues: string[];
  noteValues: string[];
  titleValues: string[];
  selectedType: string;
  selectedTags: string[];
  createdTags: string[];
  isValid: boolean;
}

const SubmitContentBox: React.FC<SubmitContentBoxProps> = ({
  situationValues,
  assumptionValues,
  reflectionValues,
  counterFactualReflectionValues,
  noteValues,
  titleValues,
  selectedType,
  selectedTags,
  createdTags,
  isValid,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isValidUser, setIsValidUser] = useState(false);

  const handleTurnstileValidation = (isValid: boolean) => {
    setIsValidUser(isValid);
  }

  const allLabeledTags = selectedTags.concat(createdTags);


  const handleSubmit = async () => {
    try {
      const response = await fetch("/maketext", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          situationValues,
          assumptionValues,
          reflectionValues,
          counterFactualReflectionValues,
          noteValues,
          titleValues,
          selectedType,
          allLabeledTags,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const postedURL = data.url;
        console.log(postedURL)

        // 新しいウィンドウでURLを開く
        window.open(postedURL, '_blank');
      } else {
        console.error('投稿エラー:', response.status);
        alert('投稿中にエラーが発生しました。');
      }
  } catch (error) {
    console.error('投稿エラー:', error);
    alert('投稿中にエラーが発生しました。');
  }
  };

  return (
    <div>
      <div className="checkbox mb-3">
        <Turnstile siteKey={VITE_CF_TURNSTILE_SITEKEY} onSuccess={() => handleTurnstileValidation(true)} />
      </div>
      <Button disabled = {!isValidUser || !isValid} variant="primary" onClick={() => setShowModal(true)}>
        投稿する
      </Button>
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>投稿確認</Modal.Title>
        </Modal.Header>
        <Modal.Body>本当に投稿しますか？</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            戻る
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            投稿する
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SubmitContentBox;