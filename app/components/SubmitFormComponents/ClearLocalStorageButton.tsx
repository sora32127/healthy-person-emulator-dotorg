import { useState } from 'react';
import { H3 } from '../Headings';

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
      <H3>入力内容をクリア</H3>
      <p>入力内容をクリアします。</p>
      <button
        className="inline-flex items-center px-4 py-2 my-4 border border-transparent text-base font-medium rounded-md shadow-sm btn-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        onClick={() => setShowModal(true)}
        type='button'
      >
        入力をクリア
      </button>

      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-base-200 bg-opacity-75 transition-opacity"></div>
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="inline-block align-bottom bg-base-200 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-base-200 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium" id="modal-title">
                      確認
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm">
                        入力内容をクリアしますか？
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-base-200 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md shadow-sm px-4 py-2 bg-warning text-base font-medium text-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleClearLocalStorage}
                >
                  はい
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md shadow-sm px-4 py-2 bg-white text-base font-medium text-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowModal(false)}
                >
                  いいえ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ClearLocalStorageButton;
