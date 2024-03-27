import React, { useState } from 'react';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';
import styled from 'styled-components';

interface ToggleButtonProps {
  onToggle: (selectedType: string) => void; // トグルの状態が変わった時に親コンポーネントに通知するための関数
}

const StyledToggleButton = styled(ToggleButton)`
  border-radius: 20px;
  width: 60px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  padding: 0;
  margin: 0 5px;
  border: none;
  background-color: ${props => props.checked ? '#007BFF' : '#6C757D'};
  color: white;
  &:hover {
    background-color: ${props => props.checked ? '#0056b3' : '#5a6268'};
  }
`;

const TextTypeSwitcher: React.FC<ToggleButtonProps> = ({ onToggle }) => {
  const [selectedType, setSelectedType] = useState('misDeed'); // 初期状態は「やってはいけなかったこと」が選択されているとする

  const toggleSelection = (type: string) => {
    setSelectedType(type);
    onToggle(type);
  };

  return (
    <ButtonGroup>
      <StyledToggleButton
        id="1"
        type="radio"
        checked={selectedType === 'goodDeed'}
        value="goodDeed"
        onChange={() => toggleSelection('goodDeed')}
      >
        結果善
      </StyledToggleButton>
      <StyledToggleButton
        id="2"
        type="radio"
        checked={selectedType === 'misDeed'}
        value="misDeed"
        onChange={() => toggleSelection('misDeed')}
      >
        結果悪
      </StyledToggleButton>
    </ButtonGroup>
  );
};

export default TextTypeSwitcher;