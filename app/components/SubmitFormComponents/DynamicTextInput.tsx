import React from 'react';
import { Form } from "@remix-run/react";

interface DynamicTextInputProps {
  description?: string;
  onInputChange: (values: string[]) => void;
  parentComponentStateValues: string[];
}

const DynamicTextInput: React.FC<DynamicTextInputProps> = ({
  description = "",
  onInputChange,
  parentComponentStateValues,
}) => {
  const handleInputChange = (index: number, value: string) => {
    const updatedValues = [...parentComponentStateValues];
    updatedValues[index] = value;
    onInputChange(updatedValues);
  };

  const addInput = () => {
    onInputChange([...parentComponentStateValues, ""]);
  };

  const deleteInput = (index: number) => {
    const updatedValues = parentComponentStateValues.filter((_, i) => i !== index);
    onInputChange(updatedValues);
  };

  return (
    <div className="mb-8">
      {description && <p className="mb-4">{description}</p>}
      <Form className="space-y-4">
        {parentComponentStateValues.map((value, index) => (
          <div key={`input-${index}`} className="flex items-center space-x-2">
            <input
              type="text"
              id={`input-${index}`}
              value={value}
              onChange={(e) => handleInputChange(index, e.target.value)}
              className="flex-grow px-3 py-2 border rounded-lg focus:outline-none"
            />
            <button
              type="button"
              onClick={() => deleteInput(index)}
              className="px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none"
            >
              削除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addInput}
          className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none"
        >
          テキスト入力を追加
        </button>
      </Form>
    </div>
  );
};

export default DynamicTextInput;
