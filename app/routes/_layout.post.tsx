import { useForm, type SubmitHandler, FormProvider, useFormContext, useWatch, useFieldArray } from "react-hook-form"
import { useEffect, useState } from "react"
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, json, NavLink, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import UserExplanation from "~/components/SubmitFormComponents/UserExplanation";
import ClearFormButton from "~/components/SubmitFormComponents/ClearFormButton";
import { H3 } from "~/components/Headings";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { getStopWords, getTagsCounts, prisma } from "~/modules/db.server";
import TagCreateBox from "~/components/SubmitFormComponents/TagCreateBox";
import TagPreviewBox from "~/components/SubmitFormComponents/TagPreviewBox";
import { Modal } from "~/components/Modal";
import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { useSubmit } from "@remix-run/react";
import { getClientIPAddress } from "remix-utils/get-client-ip-address";
import { createEmbedding } from "~/modules/embedding.server";
import { FaCopy } from "react-icons/fa";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { toast, Toaster } from "react-hot-toast";
import { createPostFormSchema } from "~/schemas/post.schema";
import { Turnstile } from "@marsidev/react-turnstile";
import { getTurnStileSiteKey, validateRequest } from "~/modules/security.server";


export async function loader () {
  const CFTurnstileSiteKey = await getTurnStileSiteKey();
  const tags = await getTagsCounts();
  const stopWords = await getStopWords();
  return json({ CFTurnstileSiteKey,  tags, stopWords });
}

export default function App() {
  const { CFTurnstileSiteKey, tags, stopWords } = useLoaderData<typeof loader>();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [createdTags, setCreatedTags] = useState<string[]>([]);

  const postFormSchema = createPostFormSchema(stopWords);

  const handleTagSelection = (tags: string[]) => {
    setSelectedTags(tags);
    window.localStorage.setItem('selectedTags', JSON.stringify(tags));
    methods.setValue("selectedTags", tags);
  }

  const handleTagCreated = (tag: string) => {
    setCreatedTags([...createdTags, tag]);
    window.localStorage.setItem('createdTags', JSON.stringify([...createdTags, tag]));
    methods.setValue("createdTags", [...createdTags, tag]);
  }

  const handleTagRemoved = (tag: string) => {
    setCreatedTags(createdTags.filter((t) => t !== tag));
    window.localStorage.setItem('createdTags', JSON.stringify(createdTags.filter((t) => t !== tag)));
    methods.setValue("createdTags", createdTags.filter((t) => t !== tag));
  }

  const formId = "post-form";
  type Inputs = z.infer<typeof postFormSchema>;

  const getStoredValues = () : Inputs => {
    // biome-ignore lint/suspicious/noThenProperty: <explanation>
    if (typeof window === "undefined") return { title: [], postCategory: "misDeed", situations: { who: "", what: "", when: "", where: "", why: "", how: "", then: "" }, reflection: [], counterReflection: [], note: [], selectedTags: [], createdTags: [] };
    const stored = window.localStorage.getItem(formId);
    // biome-ignore lint/suspicious/noThenProperty: <explanation>
    return stored ? JSON.parse(stored) : { title: [], postCategory: "misDeed", situations: { who: "", what: "", when: "", where: "", why: "", how: "", then: "" }, reflection: [], counterReflection: [], note: [], selectedTags: [], createdTags: [] };
  }

  const methods = useForm({
    defaultValues: getStoredValues(),
    resolver: zodResolver(postFormSchema),
  });

  const submit = useSubmit();
  const onSubmit: SubmitHandler<Inputs> = (data) => {
    const formData = new FormData();
    formData.append("_action", "firstSubmit");
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, JSON.stringify(value));
    }
        submit(formData, {
      method: "post",
      action: "/post",
    });
  };  

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(formId, JSON.stringify(methods.getValues()));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [methods.getValues]);

  const postCategory = methods.watch("postCategory");
  const actionData = useActionData<typeof action>();

  return (
    <>
    <div className="templateSubmitForm">
    <FormProvider {...methods}> 
      <Form method="post" onSubmit={methods.handleSubmit(onSubmit)}>
        <UserExplanation />
        <br/>
        <div className="flex justify-start mt-6">
          <ClearFormButton clearInputs={() => clearForm(methods.reset)}/>
        </div>
        <br/>
        <TextTypeSwitcher />
        <SituationInput />
        <DynamicTextInput description="書ききれなかった前提条件はありますか？" key="situations.assumption" />

        {postCategory === "misDeed" ? (
            <>
            <StaticTextInput
                rowNumber={3}
                title="健常行動ブレイクポイント"
                placeholders={["友人の言動は冗談だという事に気が付く必要があった","会話の中で自分がされた時に困るようなフリは避けるべきである"]}
                description="上で記述した状況がどのような点でアウトだったのかの説明です。 できる範囲で構わないので、なるべく理由は深堀りしてください。 「マナーだから」は理由としては認められません。 健常者エミュレータはマナー講師ではありません。一つずつ追加してください。3つ記入する必要はありません。"
                registerKey="reflection"
            />
            <StaticTextInput
                rowNumber={3}
                title="どうすればよかったか"
                placeholders={["冗談に対してただ笑うべきだった","詠ませた後もその句を大げさに褒めるなどして微妙な空気にさせないべきだった"]}
                description="5W1H状説明、健常行動ブレイクポイントを踏まえ、どのようにするべきだったかを提示します。"
                registerKey="counterReflection"
            />
            </>
        ) : (
            <>
            <StaticTextInput
                rowNumber={3}
                title='なぜやってよかったのか'
                placeholders={["一般的に料理とは手間のかかる作業であり、相手がかけてくれた手間に対して何らかの形で報いること、もしくは報いる意思を示すことは相手に対して敬意を表していることと等しい。","敬意はコミュニケーションに対して良い作用をもたらす"]}
                description='上で記述した行動がなぜやってよかったのか、理由を説明します。できる範囲で構わないので、なるべく理由は深堀りしてください。なんとなくただ「よかった」は理由としては認められません。一つずつ追加してください。3つ記入する必要はありません。'
                registerKey="reflection"
            />
            <StaticTextInput
                rowNumber={3}
                title='やらなかったらどうなっていたか'
                placeholders={["相手がかけた手間に対して敬意をわないことは相手を無下に扱っていることと等しい。", "関係が改善されることはなく、状況が悪ければ破局に至っていたかもしれない"]}
                description='仮に上で記述した行動を実行しなかった場合、どのような不利益が起こりうるか記述してください。推論の範囲内で構わない。'
                registerKey="counterReflection"
            />
            </>
        )}
        <StaticTextInput
            rowNumber={3}
            title='備考'
            description='書ききれなかったことを書きます'
            placeholders={postCategory === "misDeed" ? ["友人が詠んだ句は「ため池や 水がいっぱい きれいだね」だった"] : ["舌が過度に肥えてしまい、コンビニ弁当が食べられなくなった。"]}
            registerKey="note"
        />
        <TagSelectionBox allTagsOnlyForSearch={tags} onTagsSelected={handleTagSelection} parentComponentStateValues={selectedTags} />
        <TagCreateBox
            handleTagCreated={handleTagCreated}
            handleTagRemoved={handleTagRemoved}
            parentComponentStateValues={createdTags}
        /> 
        <TagPreviewBox selectedTags={selectedTags} createdTags={createdTags}/>
        <StaticTextInput
            rowNumber={1}
            title="タイトル"
            description="タイトルを入力してください"
            placeholders={["タイトル"]}
            registerKey="title"
        />
        <PreviewButton actionData={actionData} postFormSchema={postFormSchema} TurnStileSiteKey={CFTurnstileSiteKey} />
      </Form>
      </FormProvider>
    </div>
    </>
  )
}


function TextTypeSwitcher(){
    const { register } = useFormContext();
    return (
        <div className="mb-4">
            <H3>投稿タイプを選択</H3>
            <p>投稿したい経験知の種類を選択してください。</p>
            <div className="flex mt-4 rounded-lg border w-full p-4 flex-col gap-y-2">
                <div className="flex items-center gap-y-2 gap-x-2">
                    <input type="radio" id="misDeed" value="misDeed" {...register("postCategory")} className="radio radio-primary" />
                    <label htmlFor="misDeed">結果悪：</label>
                    <span className="text-sm">やってはいけないこと</span>
                </div>
                <div className="flex items-center gap-y-2 gap-x-2">
                    <input type="radio" id="goodDeed" value="goodDeed" {...register("postCategory")} className="radio radio-primary"/>
                    <label htmlFor="goodDeed">結果善：</label>
                    <span className="text-sm">やってよかったこと</span>
                </div>
            </div>
        </div>
    )
}


function SituationInput(){
    const { control, register, formState: { errors } } = useFormContext();
    const postCategory = useWatch({ control, name: "postCategory" });
    const placeholder = postCategory === "misDeed" ? [
        {
            key: "who",
            description: "その状況の「主役」は誰ですか？(Who)",
            placeholder: "自分が",
            rows: 1,
          },
          {
            key: "when",
            description: "いつ起こったことですか？(When)",
            placeholder: "友人と公園にいた時",
            rows: 1,
          },
          {
            key: "where",
            description: "どこで起こったことですか？(Where)",
            placeholder: "池の前で",
            rows: 1,
          },
          {
            key: "why",
            description: "なぜそのような行動をしたのですか？(Why)",
            placeholder:
              "「詠めそう」と言われたらそう返すのが自然な会話の流れだと思ったから",
            rows: 2,
          },
          {
            key: "what",
            description: "その主役は、何に対してはたらきかけましたか？(What)",
            placeholder: "友人に",
            rows: 1,
          },
          {
            key: "how",
            description: "その主役は、対象をどうしましたか？(How)",
            placeholder: "「詠んでみてよ」と言った",
            rows: 1,
          },
          {
            key: "then",
            description: "行動の結果としてどうなりましたか？(Then)",
            placeholder: "友人が微妙な句を詠み、微妙な空気になった",
            rows: 3,
          },
        ]
      : [
          {
            key: "who",
            description: "その状況の「主役」は誰ですか？(Who)",
            placeholder: "筆者が",
            rows: 1,
          },
          {
            key: "when",
            description: "いつ起こったことですか？(When)",
            placeholder: "コロナで同居人が家にいる時間が増えた時",
            rows: 1,
          },
          {
            key: "where",
            description: "どこで起こったことですか？(Where)",
            placeholder: "家で",
            rows: 1,
          },
          {
            key: "why",
            description: "なぜそのような行動をしたのですか？(Why)",
            placeholder: "おいしいと思ったため",
            rows: 2,
          },
          {
            key: "what",
            description: "その主役は、何に対してはたらきかけましたか？(What)",
            placeholder: "同居人が作ってくれる料理について",
            rows: 1,
          },
          {
            key: "how",
            description: "その主役は、対象をどうしましたか？(How)",
            placeholder: "相手に直接「おいしい」と伝えるようにした",
            rows: 1,
          },
          {
            key: "then",
            description: "行動の結果としてどうなりましたか？(Then)",
            placeholder:
              "相手の料理の腕が上がり、どんどん料理がおいしくなり、関係も改善された",
            rows: 3,
          },
        ];


    return (
        <div className="mb-8">
            <H3>5W1H+Then状況説明</H3>
            {placeholder.map((data, index) => {
                return (
                    <div key={data.key} className="mb-4">
                        <label
                            htmlFor={data.key}
                            className="block font-bold mb-2"
                        >
                            {data.description}
                        </label>
                        <textarea
                            id={data.key}
                            placeholder={data.placeholder}
                            rows={data.rows}
                            className="w-full px-3 py-2 text-base-content border rounded-lg focus:outline-none placeholder-slate-500"
                            {...register(`situations.${data.key}`)}
                        />
                        <div>
                        {errors.situations?.[data.key] && <ErrorMessageContainer errormessage={errors.situations?.[data.key]?.message as string} />}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function DynamicTextInput({ description, registerKey = "situations.assumption" }: {description: string, registerKey?: string}){
    const { register, control } = useFormContext();
    const { fields, append, remove } = useFieldArray({
        control,
        name: registerKey,
    });
    return (
      <div className="mb-8">
        <H3>{description}</H3>
        <div className="flex mb-4 flex-col">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-row my-2">
              <input key={field.id} {...register(`${registerKey}.${index}`)} className="w-3/4 border rounded-lg placeholder-slate-500 px-3 py-2" />
              <button type="button" onClick={() => remove(index)} className="bg-error text-error-content rounded-lg px-3 mx-3">削除</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => append("")} className="bg-info text-info-content px-3 py-2 rounded-lg">追加</button>
      </div>
    )
}

function StaticTextInput({ rowNumber, title, placeholders, description, registerKey }: { rowNumber: number, title: string, placeholders: string[], description: string, registerKey: string }){
    const { register, formState: { errors }
   } = useFormContext();
    const renderTextInputs = () => {
        const inputs = [];
        for (let i = 0; i < rowNumber; i++) {
            inputs.push(
              <div className="w-full">
                <textarea
                    key={`${title}-input-${i}`}
                    className="flex-grow px-3 py-2 border rounded-lg focus:outline-none w-full my-2 placeholder-slate-500"
                    placeholder={placeholders[i]}
                    {...register(`${registerKey}.${i}`)}
                />
                {errors[registerKey] && <ErrorMessageContainer errormessage={errors[registerKey]?.root?.message as string} />}
              </div>
            )
        }
        return inputs;
    }
    return (
        <div className="mb-8">
            <H3>{title}</H3>
            <p>{description}</p>
            <div className="flex items-center space-x-2 mb-4 flex-col">
                {renderTextInputs()}             
            </div>
        </div>
    )
}

function ErrorMessageContainer({errormessage}: {errormessage: string}){
  return (
    <div>
      <p className="text-error">
        [!] {errormessage}
      </p>
    </div>
  )
}

function clearForm(formClear: () => void){
  formClear();
  window.localStorage.clear();
}

// useActionDataを丸ごと使う
function PreviewButton({ actionData, postFormSchema, TurnStileSiteKey }: { actionData: typeof action, postFormSchema: ReturnType<typeof createPostFormSchema>, TurnStileSiteKey: string }){
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const { getValues, trigger, reset, setValue } = useFormContext();
  const [isSubmitButtonDisabled, setIsSubmitButtonDisabled] = useState(true);

  const submit = useSubmit();
  type Inputs = z.infer<typeof postFormSchema>;

  function MakeToastMessage(errors: z.ZodIssue[]): string {
    let errorMessage = "";
    if (errors.length > 0){
      errorMessage = errors.map((error) => `- ${error.message}`).join("\n");
    }
    return errorMessage;
  }

  const toastNotify = (errorMessage: string) => toast.error(errorMessage);

  const handleFirstSubmit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsSubmitButtonDisabled(true);
    setTimeout(() => {
      setIsSubmitButtonDisabled(false);
    }, 3000);
    await trigger();
    const inputData = getValues();
    const zodErrors = postFormSchema.safeParse(inputData);
    if (!zodErrors.success){
      const errorMessage = MakeToastMessage(zodErrors.error.issues);
      toastNotify(errorMessage);
      return;
    }
  
    const data = getValues() as Inputs;
    const formData = new FormData();
    formData.append("_action", "firstSubmit");
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, JSON.stringify(value));
    }
    submit(formData, { method: "post", action: "/post" });
    setShowPreviewModal(true);

  }

  const navigate = useNavigate();

  const handleSecondSubmit = async () => {
    const data = getValues() as Inputs;
    const formData = new FormData();
    formData.append("_action", "secondSubmit");
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, JSON.stringify(value));
    }
    submit(formData, { method: "post", action: "/post" });
  }

  useEffect(() => {
    if (actionData?.success && actionData?.data?.postId){
      toast.success("投稿が完了しました。リダイレクトします...");
      setTimeout(() => {
        navigate(`/archives/${actionData.data.postId}`);
        clearForm(reset);
      }, 2000);
    }
  }, [actionData, navigate, reset])


  const handleCopy = async () => {
    if (actionData?.data?.MarkdownResult){
      navigator.clipboard.writeText(actionData.data.MarkdownResult);
      toast.success("クリップボードにコピーしました");
    }
  }


  const handleTurnStileSuccess = (token: string) => {
    setValue("turnstileToken", token);
    setIsSubmitButtonDisabled(false);
  }

  return (
    <div className="flex justify-end">
      <div className="flex flex-col items-center gap-1 p-2">
        <Turnstile
          siteKey={TurnStileSiteKey}
          onSuccess={handleTurnStileSuccess}
      />
      <button
        type="submit"
        onClick={handleFirstSubmit}
        className={
          `btn
            ${isSubmitButtonDisabled ? "animate-pulse bg-base-300" : ""}
            ${!isSubmitButtonDisabled ? "btn-primary" : ""}
          `
        }
          disabled={isSubmitButtonDisabled}
        >
          投稿する
        </button>
      </div>
      <Toaster />
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="投稿内容を確認してください"
        showCloseButton={false}
      >
        <div className="postContent">
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation> */}
          <div dangerouslySetInnerHTML={{ __html: actionData?.data?.WikifiedResult ?? "" }} />
        </div>
        <div className="flex justify-between items-center mt-6 border-t pt-8 border-gray-200">
          <button type="button" onClick={() => setShowPreviewModal(false)} className="btn btn-secondary">修正する</button>
          <div className="flex flex-row items-center gap-1 p-2">
            <button 
              type="button" 
              onClick={handleCopy} 
              className="btn btn-circle"
            >
              <FaCopy />
            </button>
          </div>
          <button type="button" onClick={handleSecondSubmit} className="btn btn-primary">投稿する</button>
        </div>
      </Modal>
    </div>
  )
}



export async function action({ request }:ActionFunctionArgs){
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const postData = Object.fromEntries(formData);
  const stopWords = await getStopWords();
  const postFormSchema = createPostFormSchema(stopWords);
  type Inputs = z.infer<typeof postFormSchema>;


  const parsedData = {
    ...postData,
    postCategory: JSON.parse(postData.postCategory as string),
    situations: JSON.parse(postData.situations as string),
    reflection: JSON.parse(postData.reflection as string),
    counterReflection: JSON.parse(postData.counterReflection as string),
    note: JSON.parse(postData.note as string),
    selectedTags: JSON.parse(postData.selectedTags as string || "[]"),
    createdTags: JSON.parse(postData.createdTags as string || "[]"),
    title: JSON.parse(postData.title as string),
    turnstileToken: postData.turnstileToken as string,
  } as unknown as Inputs;

  const url = new URL(request.url);
  const origin = url.origin;
  const token = formData.get('turnstileToken')?.toString() || "";
  const isValidRequest = await validateRequest(token, origin);

  if (!isValidRequest){
    return json({
      success: false,
      error: "Invalid Request. Request-validation has failed. Please try again.",
      data: undefined
    });
  }

  if (actionType === "firstSubmit"){
    try{  
      const html = await Wikify(parsedData, postFormSchema);
      const data = await html.json();
      return json({
        success: true,
        data: data.data,
        error: undefined,
      });
    } catch (error) {
      return json({
        success: false,
        data: undefined,
        error: "Wikify failed",
      });
    }
  }

  if (actionType === "secondSubmit"){
    const html = await Wikify(parsedData, postFormSchema);
    const data = await html.json();
    const isSuccess = data.success;
    const wikifyResult = data.data?.WikifiedResult;
    const postTitle = parsedData.title[0];
    const createdTags = parsedData.createdTags;
    const selectedTags = parsedData.selectedTags;
    if (!wikifyResult) {
      return json({ success: false, error: "Wikify failed", data: undefined });
    }

    if (isSuccess){
      const hashedUserIpAddress = await getHashedUserIPAddress(request);
      if (data.data === undefined){
        return json({ success: false, error: "Wikify failed", data: undefined });
      }
      const newPost = await prisma.$transaction(async (prisma) => {
        const newPost = await prisma.dimPosts.create({
          data: {
            postAuthorIPHash: hashedUserIpAddress,
            postContent: wikifyResult,
            postTitle: postTitle,
            countLikes: 0,
            countDislikes: 0,
            commentStatus: "open",
        },
        });
        const uniqueTags = [...new Set([...selectedTags || [], ...createdTags || []])];
        const existingTags = await prisma.dimTags.findMany({
            where: {
                tagName: {
                    in: uniqueTags,
                },
            },
        });
        const existingTagNames = existingTags.map((tag) => tag.tagName);
        const newTagNames = uniqueTags.filter((tag) => !existingTagNames.includes(tag));
        const newTags = await Promise.all(newTagNames.map(async (tagName) => {
          return await prisma.dimTags.create({ data: { tagName } });
        }));
        const allTags = [...existingTags, ...newTags];
        await Promise.all(allTags.map(async (tag) => {
          return await prisma.relPostTags.create({ data: { postId: newPost.postId, tagId: tag.tagId } });
        }));
        return newPost;
      });

      await createEmbedding({
        postId: Number(newPost.postId),
        postContent: newPost.postContent,
        postTitle: newPost.postTitle,
      });
      return json({ success: true, error: undefined, data: { postId: newPost.postId } });
    }
    return json({ success: false, error: data.error, data: undefined });
  }
}

async function getHashedUserIPAddress(request: Request){
  const ipAddress = getClientIPAddress(request) || "";
  const postUserIpHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ipAddress)
  );
  const hashArray = Array.from(new Uint8Array(postUserIpHash));
  const postUserIpHashString = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return postUserIpHashString;
}

async function Wikify(postData: z.infer<ReturnType<typeof createPostFormSchema>>, postFormSchema: ReturnType<typeof createPostFormSchema>){
  // バリデーションを実施
  const validationResult = postFormSchema.safeParse(postData);
  if (!validationResult.success) {
    return json({
      success: false,
      error: validationResult.error.errors,
      data: undefined,
    });
  }

  const { who, when, where, why, what, how, then, assumption } = validationResult.data.situations;
  const { reflection, counterReflection } = validationResult.data;
  const { note, postCategory } = validationResult.data;

  function removeEmptyString(array: string[]): string[] {
    return array.filter((value) => !/^\s*$/.test(value));
  }

  const result = `
    <h3>5W1H+Then状況説明</h3>
    <table><tbody>
      <tr><td>Who(誰が)</td><td>${who}</td></tr>
      <tr><td>When(いつ)</td><td>${when}</td></tr>
      <tr><td>Where(どこで)</td><td>${where}</td></tr>
      <tr><td>Why(なぜ)</td><td>${why}</td></tr>
      <tr><td>What(何を)</td><td>${what}</td></tr>
      <tr><td>How(どのように)</td><td>${how}</td></tr>
      <tr><td>Then(どうした)</td><td>${then}</td></tr>
    </tbody></table>
    ${assumption && assumption.length > 0 ? `
      <h3>前提条件</h3>
      <ul>
        ${removeEmptyString(assumption)?.map((assumption) => `<li>${assumption}</li>`).join('\n')}
      </ul>
      ` : ''}
    <h3>
      ${postCategory === "misDeed" ? "健常行動ブレイクポイント" : postCategory === "goodDeed" ? "なぜやってよかったのか" : ""}
    </h3>
    <ul>
      ${removeEmptyString(reflection)?.map((reflection) => `<li>${reflection}</li>`).join('\n')}
    </ul>
    <h3>
      ${postCategory === "misDeed" ? "どうすればよかったか" : postCategory === "goodDeed" ? "やらなかったらどうなっていたか" : ""}
    </h3>
    <ul>
      ${removeEmptyString(counterReflection)?.map((counterReflection) => `<li>${counterReflection}</li>`).join('\n')}
    </ul>
    ${note && note.length > 0 ? `
      <h3>備考</h3>
      ${removeEmptyString(note)?.map((note) => `<li>${note}</li>`).join('\n')}
    ` : ''}
  `
  const markdownContent = NodeHtmlMarkdown.translate(result);
  return json({ success: true, error: undefined, data: { WikifiedResult : result, MarkdownResult : markdownContent } });
}

export const meta: MetaFunction = () => {
  const commonMeta = commonMetaFunction({
      title : "投稿する",
      description : "テンプレートに沿って投稿する",
      url: "https://healthy-person-emulator.org/post",
      image: null
  });
  return commonMeta;
};