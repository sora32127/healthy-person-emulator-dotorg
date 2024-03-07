import React, { useState } from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';

interface DynamicTextInputProps {
  initialInputs?: { value: string }[];
  description?: string;
  onInputChange: (values: string[]) => void;
  parentComponentStateValues: string[];
}

const DynamicTextInput: React.FC<DynamicTextInputProps> = ({
  description = "",
  onInputChange,
  parentComponentStateValues,
}) => {
  const [inputFields, setInputFields] = useState(
    parentComponentStateValues.map((value, index) => ({ id: `input-${index}`, value })
  ));
  const handleInputChange = (index: number, value: string) => {
    const updatedInputFields = inputFields.map((input, i) =>
      i === index ? { ...input, value } : input
    );
    setInputFields(updatedInputFields);
    onInputChange(updatedInputFields.map(input => input.value));
  };

  const addInput = () => {
    const newInput = {
      id: `input-${inputFields.length}`,
      value: "",
    };
    setInputFields([...inputFields, newInput]);
  };

  const deleteInput = (id: string) => {
    const updatedInputFields = inputFields.filter(input => input.id !== id);
    setInputFields(updatedInputFields);
    onInputChange(updatedInputFields.map(input => input.value));
  };

  return (
    <div>
      {description && <p className="text-start">{description}</p>}
      <Form>
        {inputFields.map((input, index) => (
          <Form.Group as={Row} key={input.id} className="mb-3">
            <Col>
              <Form.Control
                type="text"
                id={input.id}
                value={input.value}
                onChange={(e) => handleInputChange(index, e.target.value)}
              />
            </Col>
            <Col xs="auto">
              <Button variant="danger" onClick={() => deleteInput(input.id)}>
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