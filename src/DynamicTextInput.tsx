import React, { useState, useEffect } from 'react';

interface TextInputProps {
  id: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}

interface DynamicTextInputProps {
  inputs?: { placeholder: string }[];
  description?: string;
}

function TextInputFormatter({
  id,
  placeholder,
  onChange,
  onDelete,
}: TextInputProps) {
  return (
    <div className='TextInputList'>
      <input className='TextInput'
        type="text"
        id={id}
        placeholder={placeholder}
        onChange={onChange}
      />
      <button onClick={onDelete} className="TextInputDeleteButton">削除</button>
    </div>
  );
}

function DynamicTextInput({ inputs = [{ placeholder: "文章を入力してください" }], description = "" }: DynamicTextInputProps) {
  const [inputFields, setInputFields] = useState<TextInputProps[]>([]);

  useEffect(() => {
    setInputFields(inputs.map((input, index) => ({
      id: (index + 1).toString(),
      placeholder: input.placeholder,
    })));
  }, [inputs]);

  const addInput = () => {
    const newInput = {
      id: (inputFields.length + 1).toString(),
      placeholder: "",
    };
    setInputFields([...inputFields, newInput]);
  };

  const handleInputChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (index === inputFields.length - 1) {
      addInput();
    }
  };

  const deleteInput = (id: string) => {
    setInputFields(inputFields.filter(input => input.id !== id));
  };

  return (
    <div className="DynamicTextInputList">
      {description && <p>{description}</p>}
      {inputFields.map((input, index) => (
        <TextInputFormatter
          key={input.id}
          id={input.id}
          placeholder={input.placeholder}
          onChange={handleInputChange(index)}
          onDelete={() => deleteInput(input.id)}
        />
      ))}
      <button onClick={addInput}>テキスト入力を追加</button>
    </div>
  );
}

export default DynamicTextInput;
