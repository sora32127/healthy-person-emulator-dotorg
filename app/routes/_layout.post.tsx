import { useState, useEffect } from 'react';
import DynamicTextInput from '~/components/SubmitFormComponents/DynamicTextInput';
import TagSelectionBox from '~/components/SubmitFormComponents/TagSelectionBox';
import SituationInput from '~/components/SubmitFormComponents/SituationInput';
import StaticTextInput from '~/components/SubmitFormComponents/StaticTextInput';
import Preview from '~/components/SubmitFormComponents/Preview';
import TagPreviewBox from '~/components/SubmitFormComponents/TagPreviewBox';
import TagCreateBox from '~/components/SubmitFormComponents/TagCreateBox';
import SubmitContentBox from '~/components/SubmitFormComponents/SubmitContentBox';
import UserExplanation from '~/components/SubmitFormComponents/UserExplanation';
import ValidationCheckBox from '~/components/SubmitFormComponents/ValidationCheckBox';
import TextTypeSwitcher from '~/components/SubmitFormComponents/TextTypeSwitcher';
import ClearLocalStorageButton from '~/components/SubmitFormComponents/ClearLocalStorageButton';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { prisma } from '~/modules/db.server';

interface Tag {
    tagName: string;
    count: number;
}

export async function loader () {
    const CFTurnstileSiteKey = process.env.CF_TURNSTILE_SITEKEY || "";
    const tags = await prisma.dimTags.groupBy({
        by: ["tagName"],
        _count: { postId: true },
        orderBy: { _count: { postId: "desc" } },
    });
    
    const allTagsOnlyForSearch: Tag[] = tags.map(
        (tag: { tagName: string, _count: { postId: number } }) => {
        return {
            tagName: tag.tagName,
            count: tag._count.postId
        };
    });

    return json({ CFTurnstileSiteKey,  allTagsOnlyForSearch });
}

export default function Component() {
    
    const [situationValues, setSituationValues] = useState<{ [key: string]: string }>({});
    const [assumptionValues, setAssumptionValues] = useState<string[]>([]);
    const [reflectionValues, setReflectionValues] = useState<string[]>([]);
    const [counterFactualReflectionValues, setCounterFactualReflectionValues] = useState<string[]>([]);
    const [noteValues, setNoteValues] = useState<string[]>([]);
    const [titleValues, setTitleValues] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string>('misDeed');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [createdTags, setCreatedTags] = useState<string[]>([]);

    useEffect(() => {
        const savedSituationValue = window.localStorage.getItem('situationValue');
        const initialSituationValue = JSON.parse(savedSituationValue || '{}');
        setSituationValues(initialSituationValue);
        const savedAssumptionValue = window.localStorage.getItem('assumptionValue');
        const initialAssumptionValue = JSON.parse(savedAssumptionValue || '[]');
        setAssumptionValues(initialAssumptionValue);
        const savedReflectionValue = window.localStorage.getItem('reflectionValue');
        const initialReflectionValue = JSON.parse(savedReflectionValue || '[]');
        setReflectionValues(initialReflectionValue);
        const savedCounterFactualReflectionValue = window.localStorage.getItem('counterFactualReflectionValue');
        const initialCounterFactualReflectionValue = JSON.parse(savedCounterFactualReflectionValue || '[]');
        setCounterFactualReflectionValues(initialCounterFactualReflectionValue);
        const savedNoteValue = window.localStorage.getItem('noteValue');
        const initialNoteValue = JSON.parse(savedNoteValue || '[]');
        setNoteValues(initialNoteValue);
        const savedTitleValue = window.localStorage.getItem('titleValue');
        const initialTitleValue = JSON.parse(savedTitleValue || '[]');
        setTitleValues(initialTitleValue);
        const savedSelectedType = window.localStorage.getItem('selectedType');
        const initialSelectedType = savedSelectedType || 'misDeed';
        setSelectedType(initialSelectedType);
        const savedSelectedTags = window.localStorage.getItem('selectedTags');
        const initialSelectedTags = JSON.parse(savedSelectedTags || '[]');
        setSelectedTags(initialSelectedTags);
        const savedCreatedTags = window.localStorage.getItem('createdTags');
        const initialCreatedTags = JSON.parse(savedCreatedTags || '[]');
        setCreatedTags(initialCreatedTags);

    }, []);

    const handleSituationChange = (values: { [key: string]: string }) => {
        setSituationValues(values);
        window.localStorage.setItem('situationValue', JSON.stringify(values));
    };
    const handleAssumptionChange = (values: string[]) => {
        setAssumptionValues(values);
        window.localStorage.setItem('assumptionValue', JSON.stringify(values));
    };
    const handleReflectionChange = (values: string[]) => {
        setReflectionValues(values);
        window.localStorage.setItem('reflectionValue', JSON.stringify(values));
    };
    const handleCounterFactualReflectionChange = (values: string[]) => {
        setCounterFactualReflectionValues(values);
        window.localStorage.setItem('counterFactualReflectionValue', JSON.stringify(values));
    }
    const handleNoteChange = (values: string[]) => {
        setNoteValues(values);
        window.localStorage.setItem('noteValue', JSON.stringify(values));
    }
    const handleTitleChange = (values: string[]) => {
        setTitleValues(values);
        window.localStorage.setItem('titleValue', JSON.stringify(values));
    }
    const handleToggle = (selectedType: string) => {
        setSelectedType(selectedType);
        window.localStorage.setItem('selectedType', selectedType);
    }

    const handleTagSelection = (tags: string[]) => {
        setSelectedTags(tags);
        window.localStorage.setItem('selectedTags', JSON.stringify(tags));
    }
    useEffect(() => {
        window.localStorage.setItem('createdTags', JSON.stringify(createdTags));
    }, [createdTags]);

    const handleTagCreated = (tag: string) => {
    setCreatedTags((prevCreatedTags) => [...prevCreatedTags, tag]);
    };

    const handleTagRemoved = (tag: string) => {
    setCreatedTags(createdTags.filter(createdTag => createdTag !== tag));
    };

    const [isValid, setIsValid] = useState(false);
    const handleValidationResult = (result: boolean) => {
    setIsValid(result);
    };

    const clearInputs = () => {
        console.log("CLEARBUTTON")
        setSituationValues({});
        setAssumptionValues([]);
        setReflectionValues([]);
        setCounterFactualReflectionValues([]);
        setNoteValues([]);
        setTitleValues([]);
        setSelectedTags([]);
        setCreatedTags([]);
        window.localStorage.clear()
        setSelectedType('misDeed');
    };

    const { CFTurnstileSiteKey, allTagsOnlyForSearch } = useLoaderData<typeof loader>();
    
    
    return (
    <div className="templateSubmitForm">
        <UserExplanation />
        <ClearLocalStorageButton clearInputs={clearInputs}/>
        <TextTypeSwitcher onToggle={handleToggle}/>
        <SituationInput
            onInputChange={handleSituationChange}
            parentComponentStateValues={situationValues}
            selectedType={selectedType}
        />
        <br></br>
        <br></br>
        <DynamicTextInput
            description='書ききれなかった前提条件はありますか？'
            onInputChange={handleAssumptionChange}
            parentComponentStateValues={assumptionValues}
        />
        <br></br>
        <br></br>
        {selectedType === 'misDeed' ? (
            <>
            <StaticTextInput
                row={3}
                title='健常行動ブレイクポイント'
                placeholders={["友人の言動は冗談だという事に気が付く必要があった","会話の中で自分がされた時に困るようなフリは避けるべきである"]}
                description='上で記述した状況がどのような点でアウトだったのかの説明です。 できる範囲で構わないので、なるべく理由は深堀りしてください。 「マナーだから」は理由としては認められません。 健常者エミュレータはマナー講師ではありません。一つずつ追加してください。3つ記入する必要はありません。'
                onInputChange={handleReflectionChange}
                parentComponentStateValues={reflectionValues}
            />
            <StaticTextInput
                row={3}
                title='どうすればよかったか'
                placeholders={["冗談に対してただ笑うべきだった","詠ませた後もその句を大げさに褒めるなどして微妙な空気にさせないべきだった"]}
                description='5W1H状況説明、健常行動ブレイクポイントを踏まえ、どのようにするべきだったかを提示します。'
                onInputChange={handleCounterFactualReflectionChange}
                parentComponentStateValues={counterFactualReflectionValues}
            />
            </>
        ) : (
            <>
            <StaticTextInput
                row={3}
                title='なぜやってよかったのか'
                placeholders={["一般的に料理とは手間のかかる作業であり、相手がかけてくれた手間に対して何らかの形で報いること、もしくは報いる意思を示すことは相手に対して敬意を表していることと等しい。","敬意はコミュニケーションに対して良い作用をもたらす"]}
                description='上で記述した行動がなぜやってよかったのか、理由を説明します。できる範囲で構わないので、なるべく理由は深堀りしてください。なんとなくただ「よかった」は理由としては認められません。一つずつ追加してください。3つ記入する必要はありません。'
                onInputChange={handleReflectionChange}
                parentComponentStateValues={reflectionValues}
            />
            <StaticTextInput
                row={3}
                title='やらなかったらどうなっていたか'
                placeholders={["相手がかけた手間に対して敬意を払わないことは相手を無下に扱っていることと等しい。", "関係が改善されることはなく、状況が悪ければ破局に至っていたかもしれない"]}
                description='仮に上で記述した行動を実行しなかった場合、どのような不利益が起こりうるか記述してください。推論の範囲内で構いません。'
                onInputChange={handleCounterFactualReflectionChange}
                parentComponentStateValues={counterFactualReflectionValues}
            />
            </>
        )}
        <StaticTextInput
            row={3}
            title='備考'
            description='書ききれなかったことを書きます'
            placeholders={selectedType === "misDeed" ? ["友人が詠んだ句は「ため池や 水がいっぱい きれいだね」だった"] : ["舌が過度に肥えてしまい、コンビニ弁当が食べられなくなった。"]}
            onInputChange={handleNoteChange}
            parentComponentStateValues={noteValues}
        />
        <Preview
            selectedType={selectedType}
            situationValues={situationValues}
            assumptionValues={assumptionValues}
            reflectionValues={reflectionValues}
            counterFactualReflectionValues={counterFactualReflectionValues}
            noteValues={noteValues}
        />
        <br></br>
        <StaticTextInput
            row={1}
            title='タイトル'
            description='得られる教訓を要約してください'
            onInputChange={handleTitleChange}
            parentComponentStateValues={titleValues}
        />
        <TagSelectionBox
            onTagsSelected={handleTagSelection}
            parentComponentStateValues={selectedTags}
            allTagsOnlyForSearch={allTagsOnlyForSearch}
        />
        <br></br>
        <TagCreateBox
            handleTagCreated={handleTagCreated}
            handleTagRemoved={handleTagRemoved}
            parentComponentStateValues={createdTags}
        /> 
        <TagPreviewBox selectedTags={selectedTags} createdTags={createdTags}/>
        <ValidationCheckBox
            titleValues={titleValues}
            situationValues={situationValues}
            reflectionValues={reflectionValues}
            counterFactualReflectionValues={counterFactualReflectionValues}
            onValidationResult={handleValidationResult}
        />
        <SubmitContentBox
            situationValues={situationValues}
            assumptionValues={assumptionValues}
            reflectionValues={reflectionValues}
            counterFactualReflectionValues={counterFactualReflectionValues}
            noteValues={noteValues}
            titleValues={titleValues}
            selectedType={selectedType}
            selectedTags={selectedTags}
            createdTags={createdTags}
            isValid={isValid}
            CFTurnstileSiteKey={CFTurnstileSiteKey || ""}
        />
    </div>
    )
}