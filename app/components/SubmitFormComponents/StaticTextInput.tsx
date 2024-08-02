import { Form } from "@remix-run/react";
import TextInputBox from "./TextInputBox";

interface StaticTextInputProps {
  row: number;
  title?: string;
  description?: string;
  placeholders?: string[];
  onInputChange: (values: string[]) => void;
  parentComponentStateValues: string[];
}

function StaticTextInput({
  row,
  title = "",
  description = "",
  placeholders = [],
  onInputChange,
  parentComponentStateValues,
}: StaticTextInputProps) {
  const handleInputChange = (index: number, value: string) => {
    const newInputValues = [...parentComponentStateValues];
    newInputValues[index] = value;
    onInputChange(newInputValues);
  };

  const renderTextInputs = () => {
    const inputs = [];
    for (let i = 0; i < row; i++) {
      const placeholder = placeholders[i] || "";
      inputs.push(
        <div key={i} className="mb-4">
          <label htmlFor={`${title}-${i}`} className="sr-only">
            {title} {i + 1}
          </label>
          <TextInputBox
            id={`${title}-${i}`}
            className={`w-full py-2 placeholder-slate-500 rounded-lg focus:outline-none ${title}-${i}`}
            parentComponentStateValue={parentComponentStateValues[i] || ""}
            onInputChange={(value) => handleInputChange(i, value)}
            placeholder={placeholder}
          />
        </div>
      );
    }
    return inputs;
  };

  return (
    <div className="mb-8">
      {title && <h3 className="text-2xl font-bold mb-4">{title}</h3>}
      {description && <p className="mb-4">{description}</p>}
      <Form className="space-y-4">{renderTextInputs()}</Form>
    </div>
  );
}

export default StaticTextInput;