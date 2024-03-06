import React, { useState } from 'react';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';

interface ToggleButtonProps {
  onToggle: (selectedType: string) => void; // トグルの状態が変わった時に親コンポーネントに通知するための関数
}

const TextTypeSwitcher: React.FC<ToggleButtonProps> = ({ onToggle }) => {
  const [selectedType, setSelectedType] = useState('misDeed'); // 初期状態は「やってはいけなかったこと」が選択されているとする

  const toggleSelection = () => {
    const newSelectedType = selectedType === 'misDeed' ? 'goodDeed' : 'misDeed';
    setSelectedType(newSelectedType);
    onToggle(newSelectedType);
  };

  return (
    <>
    <ButtonGroup>
      <ToggleButton
        id="1"
        type="checkbox"
        variant="secondary"
        checked={selectedType === 'goodDeed'}
        value="1"
        onChange={toggleSelection}
      >
        やってよかったこと
      </ToggleButton>
      <ToggleButton
        id="2"
        type="checkbox"
        variant="secondary"
        checked={selectedType === 'misDeed'}
        value="2"
        onChange={toggleSelection}
      >
        やってはいけなかったこと
      </ToggleButton>
    </ButtonGroup>
    </>
  );
};

export default TextTypeSwitcher;