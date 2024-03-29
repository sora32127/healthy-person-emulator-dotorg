import { useState } from 'react';
import { H3 } from '../Headings';

interface ToggleButtonProps {
  onToggle: (selectedType: string) => void;
}

const ToggleButton: React.FC<{
  id: string;
  checked: boolean;
  value: string;
  onChange: () => void;
  children: React.ReactNode;
// eslint-disable-next-line react/prop-types
}> = ({ id, checked, value, onChange, children }) => {
  const baseStyle = "rounded-full w-15 h-8 flex justify-center items-center text-xs px-3 mx-1 border-0";
  const checkedStyle = "bg-blue-600 hover:bg-blue-700";
  const uncheckedStyle = "bg-gray-600 hover:bg-gray-700";

  return (
    <button
      id={id}
      value={value}
      onClick={onChange}
      className={`${baseStyle} ${checked ? checkedStyle : uncheckedStyle} text-white`}
    >
      {children}
    </button>
  );
};

const TextTypeSwitcher: React.FC<ToggleButtonProps> = ({ onToggle }: ToggleButtonProps) => {
  const [selectedType, setSelectedType] = useState('misDeed');

  const toggleSelection = (type: string) => {
    setSelectedType(type);
    onToggle(type);
  };

  return (
    <div className="mb-4">
    <H3>投稿タイプを選択</H3>
      <p>投稿したい経験知の種類を選択してください。</p>
      <div className="flex mt-4">
        <ToggleButton
          id="1"
          checked={selectedType === 'goodDeed'}
          value="goodDeed"
          onChange={() => toggleSelection('goodDeed')}
        >
          結果善
        </ToggleButton>
        <ToggleButton
          id="2"
          checked={selectedType === 'misDeed'}
          value="misDeed"
          onChange={() => toggleSelection('misDeed')}
        >
          結果悪
        </ToggleButton>
      </div>
    </div>
  );
};

export default TextTypeSwitcher;
