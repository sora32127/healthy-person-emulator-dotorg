import { H3 } from '../Headings';

interface ToggleButtonProps {
  onToggle: (selectedType: string) => void;
  parentComponentStateValue: string;
}

const ToggleButton: React.FC<{
  id: string;
  checked: boolean;
  value: string;
  onChange: () => void;
  children: React.ReactNode;
// eslint-disable-next-line react/prop-types
}> = ({ id, checked, value, onChange, children }) => {
  const baseStyle = "rounded-full w-15 h-8 flex justify-center items-center text-xs px-3 mx-1";
  const checkedStyle = "btn-secondary border-2 border-info";
  const uncheckedStyle = "btn-secondary";

  return (
    <button
      id={id}
      value={value}
      onClick={onChange}
      className={`${baseStyle} ${checked ? checkedStyle : uncheckedStyle}`}
      type='button'
    >
      {children}
    </button>
  );
};

const TextTypeSwitcher: React.FC<ToggleButtonProps> = ({ onToggle, parentComponentStateValue }: ToggleButtonProps) => {
  
  return (
    <div className="mb-4">
    <H3>投稿タイプを選択</H3>
      <p>投稿したい経験知の種類を選択してください。</p>
      <div className="flex mt-4">
        <ToggleButton
          id="1"
          checked={parentComponentStateValue == 'goodDeed'}
          value="goodDeed"
          onChange={() => onToggle('goodDeed')}
        >
          結果善
        </ToggleButton>
        <ToggleButton
          id="2"
          checked={parentComponentStateValue == 'misDeed'}
          value="misDeed"
          onChange={() => onToggle('misDeed')}
        >
          結果悪
        </ToggleButton>
      </div>
    </div>
  );
};

export default TextTypeSwitcher;
