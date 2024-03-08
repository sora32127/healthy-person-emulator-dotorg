import { useEffect, useState } from "react";
import Form from 'react-bootstrap/Form';

interface SituationInputProps {
    onInputChange: (situation: { [key: string]: string }) => void;
    parentComponentStateValues: { [key: string]: string };
}

const SituationInput = ({onInputChange, parentComponentStateValues}: SituationInputProps) => {
    const textData = [
        {
            "key": "who",
            "description": "その状況の「主役」は誰ですか？(Who)",
            "placeholder": "自分が",
            "rows" : 1
        },
        {
            "key": "when",
            "description": "いつ起こったことですか？(When)",
            "placeholder": "友人と公園にいた時",
            "rows" : 1
        },
        {
            "key": "where",
            "description": "どこで起こったことですか？(Where)",
            "placeholder": "池の前で",
            "rows" : 1
        },
        {
            "key": "why",
            "description": "なぜそのような行動をしたのですか？(Why)",
            "placeholder": "「詠めそう」と言われたらそう返すのが自然な会話の流れだと思ったから",
            "rows" : 2
        },
        {
            "key": "what",
            "description": "その主役は、何に対してはたらきかけましたか？(What)",
            "placeholder": "友人に",
            "rows" : 1
        },
        {
            "key": "how",
            "description": "その主役は、対象をどうしましたか？(How)",
            "placeholder": "「詠んでみてよ」と言った",
            "rows" : 1
        },
        {
            "key": "then",
            "description": "行動の結果としてどうなりましたか？(Then)",
            "placeholder": "友人が微妙な句を詠み、微妙な空気になった",
            "rows" : 3
        }
    ];

    const handleInputChange = (key: string, value: string) => {
        const newSituation = { ...parentComponentStateValues, [key]: value };
        onInputChange(newSituation);
    }

    return (
        <div>
            <Form>
                {textData.map((data, index) => (
                    <Form.Group key={index}>
                        <Form.Label className="d-block text-start" htmlFor={data.key}>
                            {data.description}
                        </Form.Label>
                        <Form.Control
                            as="textarea"
                            id={data.key}
                            placeholder={data.placeholder}
                            value={parentComponentStateValues[data.key] || ""}
                            rows={data.rows}
                            onChange={e => handleInputChange(data.key, e.target.value)}
                        />
                    </Form.Group>
                ))}
            </Form>
        </div>
    );
}

export default SituationInput;