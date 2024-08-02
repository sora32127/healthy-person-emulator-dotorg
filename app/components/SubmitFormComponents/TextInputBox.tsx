import { FormEvent, useCallback } from "react";

interface ComponentProps {
  id: string;
  className?: string;
  parentComponentStateValue: string;
  onInputChange: (value: string) => void;
  placeholder?: string;
}

export default function TextInputBox({
  id = "",
  className = "",
  parentComponentStateValue,
  onInputChange,
  placeholder = "",
}: ComponentProps) {
  const handleInputValue = useCallback(
    (e: FormEvent<HTMLTextAreaElement>) => {
      onInputChange(e.currentTarget.value);
    },
    [onInputChange]
  );

  return (
    <div className={className}>
      <textarea
        id={id}
        value={parentComponentStateValue}
        onChange={handleInputValue}
        placeholder={placeholder}
        className="w-full border-2 border-base-content rounded-lg p-2 placeholder-slate-500"
      />
    </div>
  );
}
