import React, { useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

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
  CF_TURNSTILE_SITEKEY: string;
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
  CFTurnstileSiteKey,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isValidUser, setIsValidUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTurnstileValidation = (isValid: boolean) => {
    setIsValidUser(isValid);
  };

  const allLabeledTags = selectedTags.concat(createdTags);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/maketext", {
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
        console.log(data.url);
        window.open(data.url, '_blank');
      } else {
        console.error('投稿エラー:', response.status);
        alert('投稿中にエラーが発生しました。');
      }
    } catch (error) {
      console.error('投稿エラー:', error);
      alert('投稿中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
      setShowModal(false);
    }
  };

  return (
    <div>
      <div className="checkbox mb-3">
        <Turnstile siteKey={CFTurnstileSiteKey} onSuccess={() => handleTurnstileValidation(true)} />
      </div>
      <button
        className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${(!isValidUser || !isValid || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!isValidUser || !isValid || isSubmitting}
        onClick={() => setShowModal(true)}
      >
        投稿する
      </button>
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      投稿確認
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">本当に投稿しますか？</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-500 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '投稿中...' : '投稿する'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  戻る
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitContentBox;