import React, { useState } from 'react';
import { GoogleReCaptcha, GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { Button, Modal } from 'react-bootstrap';

const VITE_RECAPTCHA_KEY = import.meta.env.VITE_RECAPTCHA_KEY

interface SubmitContentBoxProps {
  situationValues: { [key: string]: string };
  assumptionValues: string[];
  reflectionValues: string[];
  counterFactualReflectionValues: string[];
  noteValues: string[];
  titleValues: string[];
  selectedType: string;
  selectedTags: string[];
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
}) => {
  const [isVerified, setIsVerified] = useState(true); // 本番時はfalseにする
  const [showModal, setShowModal] = useState(false);

  const handleRecaptchaVerify = (token: string | null) => {
    if (token) {
      setIsVerified(true);
    }
  };
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
          selectedTags,
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
      <GoogleReCaptchaProvider reCaptchaKey={VITE_RECAPTCHA_KEY}>
        <GoogleReCaptcha onVerify={handleRecaptchaVerify} />
      </GoogleReCaptchaProvider>
      {isVerified ? (
        <Button variant="primary" onClick={() => setShowModal(true)}>
          投稿する
        </Button>
      ) : (
        <p>ReCAPTCHA認証を行ってください。</p>
      )}

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