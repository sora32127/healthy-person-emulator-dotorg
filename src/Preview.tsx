import React from 'react';
import { Container, Row, Col, Table } from 'react-bootstrap';
import styled from 'styled-components';

interface PreviewProps {
  situationValues: { [key: string]: string };
  assumptionValues: string[];
  reflectionValues: string[];
  counterFactualReflectionValues: string[];
  noteValues: string[];
  selectedType: string;
}

const PreviewContainer = styled(Container)`
  background-color: #5F524F;
  padding: 20px;
  border-radius: 5px;
`;

const Preview: React.FC<PreviewProps> = ({
  situationValues,
  assumptionValues,
  reflectionValues,
  counterFactualReflectionValues,
  noteValues,
  selectedType,
}) => {
  return (
    <PreviewContainer>
      <Row>
        <Col>
          <h1 className="text-start">プレビュー</h1>
          <p>入力した内容を確認します</p>
          <Table bordered responsive="xl">
            <tbody>
              <tr>
                <th>Who(誰が)</th>
                <td>{situationValues.who}</td>
              </tr>
              <tr>
                <th>When(いつ)</th>
                <td>{situationValues.when}</td>
              </tr>
              <tr>
                <th>Where(どこで)</th>
                <td>{situationValues.where}</td>
              </tr>
              <tr>
                <th>Why(なぜ)</th>
                <td>{situationValues.why}</td>
              </tr>
              <tr>
                <th>What(何を)</th>
                <td>{situationValues.what}</td>
              </tr>
              <tr>
                <th>How(どうした)</th>
                <td>{situationValues.how}</td>
              </tr>
              <tr>
                <th>Then(どうなった)</th>
                <td>{situationValues.then}</td>
              </tr>
            </tbody>
          </Table>

          <h4 className="text-start">前提条件</h4>
          <ul className="text-start">
            {assumptionValues.map((value, index) => (
              <li key={index}>{value}</li>
            ))}
          </ul>

          {selectedType === 'misDeed' ? (
            <>
              <h3 className="text-start">健常行動ブレイクポイント</h3>
              <ul className="text-start">
                {reflectionValues.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>

              <h3 className="text-start">どうすればよかったか</h3>
              <ul className="text-start">
                {counterFactualReflectionValues.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3 className="text-start">なぜやってよかったのか</h3>
              <ul className="text-start">
                {reflectionValues.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>

              <h3 className="text-start">やらなかったらどうなっていたか</h3>
              <ul className="text-start">
                {counterFactualReflectionValues.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>
            </>
          )}

          <h3 className="text-start">備考</h3>
          <ul className="text-start">
            {noteValues.map((value, index) => (
              <li key={index}>{value}</li>
            ))}
          </ul>
        </Col>
      </Row>
    </PreviewContainer>
  );
};

export default Preview;