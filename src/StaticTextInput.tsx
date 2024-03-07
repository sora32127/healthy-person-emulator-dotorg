import { useState } from 'react';
import { Form } from 'react-bootstrap';

interface StaticTextInputProps {
  row: number;
  title?: string;
  description?: string;
  placeholders?: string[];
  onInputChange: (values: string[]) => void;
  parentComponentStateValues: string[];
}

function StaticTextInput({ row, title = '', description = '', placeholders = [], onInputChange, parentComponentStateValues}: StaticTextInputProps) {
    const [inputValues, setInputValues] = useState<string[]>(parentComponentStateValues);
    const handleInputChange = (index: number, value: string) => {
        const newInputValues = [...inputValues];
        newInputValues[index] = value;
        setInputValues(newInputValues);
        onInputChange(newInputValues);
      };
    
    const renderTextInputs = () => {
    const inputs = [];
    for (let i = 0; i < row; i++) {
      const placeholder = placeholders[i] || '';
      inputs.push(
        <Form.Group key={i} className="mb-3">
          <Form.Control
            type="text"
            placeholder={placeholder}
            value={inputValues[i]}
            onChange={(e) => handleInputChange(i, e.target.value)}
            />
        </Form.Group>
      );
    }
    return inputs;
  };

  return (
    <div>
      {title && <h3 className="text-start">{title}</h3>}
      {description && <p className="text-start">{description}</p>}
      <Form>{renderTextInputs()}</Form>
    </div>
  );
}

export default StaticTextInput;