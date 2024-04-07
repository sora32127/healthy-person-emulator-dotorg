import { Form } from "@remix-run/react";

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
          <textarea
            placeholder={placeholder}
            value={parentComponentStateValues[i] || ""}
            onChange={(e) => handleInputChange(i, e.target.value)}
            className={`w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none ${title}-${i}`}
            rows={4}
          />
        </div>
      );
    }
    return inputs;
  };

  return (
    <div className="mb-8">
      {title && <h3 className="text-2xl font-bold mb-4">{title}</h3>}
      {description && <p className="text-gray-600 mb-4">{description}</p>}
      <Form className="space-y-4">{renderTextInputs()}</Form>
    </div>
  );
}

export default StaticTextInput;
