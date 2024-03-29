import React from 'react';

interface PreviewProps {
  situationValues: { [key: string]: string };
  assumptionValues: string[];
  reflectionValues: string[];
  counterFactualReflectionValues: string[];
  noteValues: string[];
  selectedType: string;
}

const Preview: React.FC<PreviewProps> = ({
  situationValues,
  assumptionValues,
  reflectionValues,
  counterFactualReflectionValues,
  noteValues,
  selectedType,
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div>
        <h1 className="text-3xl font-bold mb-4">プレビュー</h1>
        <p className="text-gray-600 mb-6">入力した内容を確認します</p>
        <table className="w-full border-collapse border border-gray-300">
          <tbody>
            <tr>
              <th className="bg-gray-100 p-2 border border-gray-300">Who(誰が)</th>
              <td className="p-2 border border-gray-300">{situationValues.who}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 p-2 border border-gray-300">When(いつ)</th>
              <td className="p-2 border border-gray-300">{situationValues.when}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 p-2 border border-gray-300">Where(どこで)</th>
              <td className="p-2 border border-gray-300">{situationValues.where}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 p-2 border border-gray-300">Why(なぜ)</th>
              <td className="p-2 border border-gray-300">{situationValues.why}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 p-2 border border-gray-300">What(何を)</th>
              <td className="p-2 border border-gray-300">{situationValues.what}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 p-2 border border-gray-300">How(どうした)</th>
              <td className="p-2 border border-gray-300">{situationValues.how}</td>
            </tr>
            <tr>
              <th className="bg-gray-100 p-2 border border-gray-300">Then(どうなった)</th>
              <td className="p-2 border border-gray-300">{situationValues.then}</td>
            </tr>
          </tbody>
        </table>

        <h4 className="text-xl font-bold mt-8 mb-4">前提条件</h4>
        <ul className="list-disc list-inside mb-6">
          {assumptionValues.map((value, index) => (
            <li key={index} className="text-gray-700">{value}</li>
          ))}
        </ul>

        {selectedType === 'misDeed' ? (
          <>
            <h3 className="text-2xl font-bold mt-8 mb-4">健常行動ブレイクポイント</h3>
            <ul className="list-disc list-inside mb-6">
              {reflectionValues.map((value, index) => (
                <li key={index} className="text-gray-700">{value}</li>
              ))}
            </ul>

            <h3 className="text-2xl font-bold mt-8 mb-4">どうすればよかったか</h3>
            <ul className="list-disc list-inside mb-6">
              {counterFactualReflectionValues.map((value, index) => (
                <li key={index} className="text-gray-700">{value}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h3 className="text-2xl font-bold mt-8 mb-4">なぜやってよかったのか</h3>
            <ul className="list-disc list-inside mb-6">
              {reflectionValues.map((value, index) => (
                <li key={index} className="text-gray-700">{value}</li>
              ))}
            </ul>

            <h3 className="text-2xl font-bold mt-8 mb-4">やらなかったらどうなっていたか</h3>
            <ul className="list-disc list-inside mb-6">
              {counterFactualReflectionValues.map((value, index) => (
                <li key={index} className="text-gray-700">{value}</li>
              ))}
            </ul>
          </>
        )}

        <h3 className="text-2xl font-bold mt-8 mb-4">備考</h3>
        <ul className="list-disc list-inside">
          {noteValues.map((value, index) => (
            <li key={index} className="text-gray-700">{value}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Preview;
