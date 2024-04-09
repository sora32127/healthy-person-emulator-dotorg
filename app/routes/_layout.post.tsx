import { useState, useEffect } from 'react';
import DynamicTextInput from '~/components/SubmitFormComponents/DynamicTextInput';
import TagSelectionBox from '~/components/SubmitFormComponents/TagSelectionBox';
import SituationInput from '~/components/SubmitFormComponents/SituationInput';
import StaticTextInput from '~/components/SubmitFormComponents/StaticTextInput';
import Preview from '~/components/SubmitFormComponents/Preview';
import TagPreviewBox from '~/components/SubmitFormComponents/TagPreviewBox';
import TagCreateBox from '~/components/SubmitFormComponents/TagCreateBox';
import UserExplanation from '~/components/SubmitFormComponents/UserExplanation';
import ValidationCheckBox from '~/components/SubmitFormComponents/ValidationCheckBox';
import TextTypeSwitcher from '~/components/SubmitFormComponents/TextTypeSwitcher';
import ClearLocalStorageButton from '~/components/SubmitFormComponents/ClearLocalStorageButton';
import { ActionFunctionArgs, json, redirect } from '@remix-run/node';
import { Form, MetaFunction, NavLink, useLoaderData } from '@remix-run/react';
import { prisma } from '~/modules/db.server';
import { Turnstile } from '@marsidev/react-turnstile';
import { getClientIPAddress } from 'remix-utils/get-client-ip-address';
import { createEmbedding } from '~/modules/embedding.server';


interface Tag {
    tagName: string;
    count: number;
}

export async function loader () {
    const CFTurnstileSiteKey = process.env.CF_TURNSTILE_SITEKEY || "";
    const tags = await prisma.dimTags.findMany({
        select: {
          tagName: true,
          _count: {
            select: { relPostTags: true },
          },
        },
        orderBy: {
          relPostTags: {
            _count: "desc",
          },
        },
      });
      const allTagsOnlyForSearch: Tag[] = tags.map((tag) => {
        return { tagName: tag.tagName, count: tag._count.relPostTags };
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

    const [isValidUser, setIsValidUser] = useState(false);

    const handleTurnstileValidation = (isValid: boolean) => {
        setIsValidUser(isValid);
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
        <Form method="post">
        <UserExplanation />
        <br></br>
        <NavLink
            className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800 underline underline-offset-4"
            to="/freeStylePost"
        >自由投稿フォームに移動</NavLink>
        <ClearLocalStorageButton clearInputs={clearInputs}/>
        <TextTypeSwitcher onToggle={handleToggle} parentComponentStateValue={selectedType}/>
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
        <Turnstile siteKey={CFTurnstileSiteKey} onSuccess={() => handleTurnstileValidation(true)}/>
        <button
            type="submit"
            className={`rounded-md block w-full px-4 py-2 text-center text-white my-4 ${
              isValid && isValidUser
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
            disabled={!isValid || !isValidUser}
        >
        投稿する
        </button>
        <input type="hidden" name="situationValues" value={JSON.stringify(situationValues)} />
        <input type="hidden" name="assumptionValues" value={JSON.stringify(assumptionValues)} />
        <input type="hidden" name="reflectionValues" value={JSON.stringify(reflectionValues)} />
        <input type="hidden" name="counterFactualReflectionValues" value={JSON.stringify(counterFactualReflectionValues)} />
        <input type="hidden" name="noteValues" value={JSON.stringify(noteValues)} />
        <input type="hidden" name="titleValues" value={JSON.stringify(titleValues)} />
        <input type="hidden" name="selectedType" value={selectedType} />
        <input type="hidden" name="selectedTags" value={JSON.stringify(selectedTags)} />
        <input type="hidden" name="createdTags" value={JSON.stringify(createdTags)} />
        </Form>
    </div>
    )
}

function removeEmptyString(array: string[]): string[] {
    return array.filter((value) => !/^\s*$/.test(value));
  }

export async function action({ request }:ActionFunctionArgs ) {
    const formData = await request.formData();
    const situationValues = JSON.parse(formData.get('situationValues') as string);
    let assumptionValues = JSON.parse(formData.get('assumptionValues') as string);
    let reflectionValues = JSON.parse(formData.get('reflectionValues') as string);
    let counterFactualReflectionValues = JSON.parse(formData.get('counterFactualReflectionValues') as string);
    let noteValues = JSON.parse(formData.get('noteValues') as string);
    const titleValues = JSON.parse(formData.get('titleValues') as string);
    const selectedType = formData.get('selectedType') as string;
    const selectedTags = JSON.parse(formData.get('selectedTags') as string);
    const createdTags = JSON.parse(formData.get('createdTags') as string);
    
    assumptionValues = removeEmptyString(assumptionValues);
    reflectionValues = removeEmptyString(reflectionValues);
    counterFactualReflectionValues = removeEmptyString(counterFactualReflectionValues);
    noteValues = removeEmptyString(noteValues);

    const result = `
        <h3>5W1H+Then状況説明</h3>
        <table><tbody>
          <tr><td>Who(誰が)</td><td>${situationValues.who || ''}</td></tr>
          <tr><td>When(いつ)</td><td>${situationValues.when || ''}</td></tr>
          <tr><td>Where(どこで)</td><td>${situationValues.where || ''}</td></tr>
          <tr><td>Why(なぜ)</td><td>${situationValues.why || ''}</td></tr>
          <tr><td>What(何を)</td><td>${situationValues.what || ''}</td></tr>
          <tr><td>How(どのように)</td><td>${situationValues.how || ''}</td></tr>
          <tr><td>Then(どうした)</td><td>${situationValues.then || ''}</td></tr>
        </tbody></table>
        ${assumptionValues.length > 0 ? `
          <h3>前提条件</h3>
          <ul>
            ${assumptionValues.map((assumption: string) => `<li>${assumption}</li>`).join('')}
          </ul>
        ` : ''}
        <h3>
          ${selectedType == 'misDeed'
            ? '健常行動ブレイクポイント'
            : selectedType == 'goodDeed'
            ? 'なぜやってよかったのか'
            : ''}
        </h3>
        <ul>
          ${reflectionValues.map((reflection: string) => `<li>${reflection}</li>`).join('')}
        </ul>

        <h3>
          ${selectedType == 'misDeed'
            ? 'どうすればよかったか'
            : selectedType == 'goodDeed'
            ? 'やらなかったらどうなっていたか'
            : ''}
        </h3>
        <ul>
          ${counterFactualReflectionValues.map((counterFactualReflection: string) => `<li>${counterFactualReflection}</li>`).join('')}
        </ul>

        ${noteValues.length > 0 ? `
          <h3>備考</h3>
          <ul>
            ${noteValues.map((note: string) => `<li>${note}</li>`).join('')}
          </ul>
        ` : ''}
      `;

    const ip = getClientIPAddress(request) || "";
    const postUserIpHash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(ip)
    );
    const hashArray = Array.from(new Uint8Array(postUserIpHash));
    const postUserIpHashString = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const newPost = await prisma.$transaction(async (prisma) => {
        const newPost = await prisma.dimPosts.create({
            data: {
                postAuthorIPHash: postUserIpHashString,
                postContent: result,
                postTitle: titleValues.join(''),
                countLikes: 0,
                countDislikes: 0,
                commentStatus: "open",
            },
        });
        const uniqueTags = [...new Set([...selectedTags, ...createdTags])];
        const existingTags = await prisma.dimTags.findMany({
            where: {
                tagName: {
                    in: uniqueTags,
                },
            },
        });

        const existingTagNames = existingTags.map((tag) => tag.tagName);
        const newTagNames = uniqueTags.filter((tag) => !existingTagNames.includes(tag));

        const newTags = await Promise.all(
            newTagNames.map((tagName) =>
                prisma.dimTags.create({
                    data: {
                        tagName,
                    },
                })
            )
        );

        const allTags = [...existingTags, ...newTags];
        await Promise.all(
            allTags.map((tag) =>
                prisma.relPostTags.create({
                    data: {
                        postId: newPost.postId,
                        tagId: tag.tagId,
                    },
                })
            )
        );
        
        return newPost
    });

    await createEmbedding({
        postId: Number(newPost.postId),
        postContent: newPost.postContent
    });

    return redirect(`/archives/${newPost.postId}`);
}

export const meta: MetaFunction = () => {
    const title = "投稿する";
    const description = "テンプレートに沿って投稿する";
    const ogLocale = "ja_JP";
    const ogSiteName = "健常者エミュレータ事例集";
    const ogType = "article";
    const ogTitle = title;
    const ogDescription = description;
    const ogUrl = `https://healthy-person-emulator.org/post`;
    const twitterCard = "summary"
    const twitterSite = "@helthypersonemu"
    const twitterTitle = title
    const twitterDescription = description
    const twitterCreator = "@helthypersonemu"
    const twitterImage = "https://qc5axegmnv2rtzzi.public.blob.vercel-storage.com/favicon-CvNSnEUuNa4esEDkKMIefPO7B1pnip.png"
  
    return [
      { title },
      { description },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: ogDescription },
      { property: "og:locale", content: ogLocale },
      { property: "og:site_name", content: ogSiteName },
      { property: "og:type", content: ogType },
      { property: "og:url", content: ogUrl },
      { name: "twitter:card", content: twitterCard },
      { name: "twitter:site", content: twitterSite },
      { name: "twitter:title", content: twitterTitle },
      { name: "twitter:description", content: twitterDescription },
      { name: "twitter:creator", content: twitterCreator },
      { name: "twitter:image", content: twitterImage },
    ];
  };
  