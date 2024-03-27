import Form from 'react-bootstrap/Form';

interface SituationInputProps {
    onInputChange: (situation: { [key: string]: string }) => void;
    parentComponentStateValues: { [key: string]: string };
    selectedType: string;

}

const SituationInput = ({onInputChange, parentComponentStateValues, selectedType}: SituationInputProps) => {
    
    const textData = selectedType === "misDeed" ? [
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
    ] : [
        {
            "key": "who",
            "description": "その状況の「主役」は誰ですか？(Who)",
            "placeholder": "筆者が",
            "rows" : 1
        },
        {
            "key": "when",
            "description": "いつ起こったことですか？(When)",
            "placeholder": "コロナで同居人が家にいる時間が増えた時",
            "rows" : 1
        },
        {
            "key": "where",
            "description": "どこで起こったことですか？(Where)",
            "placeholder": "家で",
            "rows" : 1
        },
        {
            "key": "why",
            "description": "なぜそのような行動をしたのですか？(Why)",
            "placeholder": "おいしいと思ったため",
            "rows" : 2
        },
        {
            "key": "what",
            "description": "その主役は、何に対してはたらきかけましたか？(What)",
            "placeholder": "同居人が作ってくれる料理について",
            "rows" : 1
        },
        {
            "key": "how",
            "description": "その主役は、対象をどうしましたか？(How)",
            "placeholder": "相手に直接「おいしい」と伝えるようにした",
            "rows" : 1
        },
        {
            "key": "then",
            "description": "行動の結果としてどうなりましたか？(Then)",
            "placeholder": "相手の料理の腕が上がり、どんどん料理がおいしくなり、関係も改善された",
            "rows" : 3
        }
    ];


    const handleInputChange = (key: string, value: string) => {
        const newSituation = { ...parentComponentStateValues, [key]: value };
        onInputChange(newSituation);
    }

    return (
        <div>
            <h3>5W1H+Then状況説明</h3>
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