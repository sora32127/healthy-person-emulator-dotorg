import { useState } from "react";

const SituationInput = () => {
    const [situation, setSituation] = useState({});

    const textData = [
        {
            "key": "who",
            "description": "その状況の「主役」は誰ですか？(Who)",
            "placeholder": "自分が"
        },
        {
            "key": "when",
            "description": "いつ起こったことですか？(When)",
            "placeholder": "友人と公園にいた時"
        },
        {
            "key": "where",
            "description": "どこで起こったことですか？(Where)",
            "placeholder": "池の前で"
        },
        {
            "key": "why",
            "description": "なぜそのような行動をしたのですか？(Why)",
            "placeholder": "「詠めそう」と言われたらそう返すのが自然な会話の流れだと思ったから"
        },
        {
            "key": "what",
            "description": "その主役は、何に対してはたらきかけましたか？(What)",
            "placeholder": "友人に"
        },
        {
            "key": "how",
            "description": "その主役は、対象をどうしましたか？(How)",
            "placeholder": "「詠んでみてよ」と言った"
        },
        {
            "key": "then",
            "description": "行動の結果としてどうなりましたか？(Then)",
            "placeholder": "友人が微妙な句を詠み、微妙な空気になった"
        }
    ];

    return (
        <div>
            <div>
                {textData.map((data, index) => (
                    <div key={index}>
                        <p>{data.description}</p>
                        <input
                            type="text"
                            placeholder={data.placeholder}
                            value={situation[data.key] || ""}
                            onChange={e => setSituation({...situation, [data.key]: e.target.value})}
                        />
                    </div>
                ))}
            </div>
            <div>
                <table border="1">
                    <tbody>
                        <tr>
                            <th>Who(誰が)</th>
                            <td>{situation.who || ""}</td>
                        </tr>
                        <tr>
                            <th>When(いつ)</th>
                            <td>{situation.when || ""}</td>
                        </tr>
                        <tr>
                            <th>Where(どこで)</th>
                            <td>{situation.where || ""}</td>
                        </tr>
                        <tr>
                            <th>Why(なぜ)</th>
                            <td>{situation.why || ""}</td>
                        </tr>
                        <tr>
                            <th>What(なにを)</th>
                            <td>{situation.what || ""}</td>
                        </tr>
                        <tr>
                            <th>How(どのように)</th>
                            <td>{situation.how || ""}</td>
                        </tr>
                        <tr>
                            <th>Then(どうなった)</th>
                            <td>{situation.then || ""}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default SituationInput;
