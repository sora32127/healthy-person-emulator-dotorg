import React, { useEffect, useState } from 'react';

interface ValidationCheckBoxProps {
  titleValues: string[];
  situationValues: { [key: string]: string };
  reflectionValues: string[];
  counterFactualReflectionValues: string[];
  onValidationResult: (result: boolean) => void;
}

const ValidationCheckBox: React.FC<ValidationCheckBoxProps> = ({
  titleValues,
  situationValues,
  reflectionValues,
  counterFactualReflectionValues,
  onValidationResult,
}) => {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const newErrors: string[] = [];

    if (titleValues.length === 0 || titleValues[0].trim() === '') {
      newErrors.push('タイトルを入力してください。');
    }

    if (Object.keys(situationValues).length === 0) {
      newErrors.push('5W1H+Then状況説明を入力してください。');
    }

    if (reflectionValues.length === 0) {
      newErrors.push('「健常行動ブレイクポイント」、もしくは「なぜやってよかったのか」を入力してください。');
    }

    if (counterFactualReflectionValues.length === 0) {
      newErrors.push('「どうすればよかったか」、もしくは「やらなかったらどうなっていたか」を入力してください。');
    }

    setErrors(newErrors);
    onValidationResult(newErrors.length === 0);
  }, [titleValues, situationValues, reflectionValues, counterFactualReflectionValues, onValidationResult]);

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-100 border border-red-400 text-error px-4 py-3 rounded relative mb-4" role="alert">
      <strong className="font-bold block mb-2">入力が不完全です</strong>
      <ul className="list-disc list-inside">
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  );
};

export default ValidationCheckBox;
