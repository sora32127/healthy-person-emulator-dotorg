import React from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';

interface DynamicTextInputProps {
  description?: string;
  onInputChange: (values: string[]) => void;
  parentComponentStateValues: string[];
}

const DynamicTextInput: React.FC<DynamicTextInputProps> = ({
  description = "",
  onInputChange,
  parentComponentStateValues,
}) => {
  const handleInputChange = (index: number, value: string) => {
    const updatedValues = [...parentComponentStateValues];
    updatedValues[index] = value;
    onInputChange(updatedValues);
  };

  const addInput = () => {
    onInputChange([...parentComponentStateValues, ""]);
  };

  const deleteInput = (index: number) => {
    const updatedValues = parentComponentStateValues.filter((_, i) => i !== index);
    onInputChange(updatedValues);
  };

  return (
    <div>
      {description && <p className="text-start">{description}</p>}
      <Form>
        {parentComponentStateValues.map((value, index) => (
          <Form.Group as={Row} key={`input-${index}`} className="mb-3">
            <Col>
              <Form.Control
                type="text"
                id={`input-${index}`}
                value={value}
                onChange={(e) => handleInputChange(index, e.target.value)}
              />
            </Col>
            <Col xs="auto">
              <Button variant="danger" onClick={() => deleteInput(index)}>
                削除
              </Button>
            </Col>
          </Form.Group>
        ))}
        <Button variant="primary" onClick={addInput}>
          テキスト入力を追加
        </Button>
      </Form>
    </div>
  );
};

export default DynamicTextInput;