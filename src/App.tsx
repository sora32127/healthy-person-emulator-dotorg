import './App.css'
import { useState } from 'react';
import DynamicTextInput from './DynamicTextInput';
import TagSelectionBox from './TagSelectionBox';
import SituationInput from './SituationInput';
import TopBar from './TopBar';
import StaticTextInput from './StaticTextInput';
import Preview from './Preview';
import TagPreviewBox from './TagPreviewBox';
import TagCreateBox from './TagCreateBox';
import SubmitContentBox from './SubmitContentBox';

function App() {

  const [ situationValues, setSituationValues] = useState<{ [key: string]: string }>({});
  const handleSituationChange = (values: { [key: string]: string }) => {
      setSituationValues(values);
  };

  const [assumptionValues, setAssumptionValues] = useState<string[]>([]);
  const handleAssumptionChange = (values: string[]) => {
      setAssumptionValues(values);
  };

  const [reflectionValues, setReflectionValues] = useState<string[]>([]);
  const handleReflectionChange = (values: string[]) => {
      setReflectionValues(values);
  }

  const [counterFactualReflectionValues, setCounterFactualReflectionValues] = useState<string[]>([]);
  const handleCounterFactualReflectionChange = (values: string[]) => {
      setCounterFactualReflectionValues(values);
  }

  const [noteValues, setNoteValues] = useState<string[]>([]);
  const handleNoteChange = (values: string[]) => {
      setNoteValues(values);
  }

  const [titleValues, setTitleValues] = useState<string[]>([]);
  const handleTitleChange = (values: string[]) => {
      setTitleValues(values);
  }

  const [selectedType, setSelectedType] = useState('misDeed');
  const handleToggle = (selectedType: string) => {
      setSelectedType(selectedType);
  }

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const handleTagSelection = (selectedTags: string[]) => {
      setSelectedTags(selectedTags);
  }

  const [createdTags, setCreatedTags] = useState<string[]>([]);
  const handleTagCreated = (tag: string) => {
    setSelectedTags([...selectedTags, tag]);
    setCreatedTags([...createdTags, tag]);
  };

  const handleTagRemoved = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
    setCreatedTags(createdTags.filter((t) => t !== tag));
  };

  return (
    <div>
      <TopBar onToggle={handleToggle} />
      <div className='main-campus'>
        <br></br>
        <br></br>
        <br></br>
        <SituationInput onInputChange={handleSituationChange} />
        <br></br>
        <br></br>
        <DynamicTextInput
          description='書ききれなかった前提条件はありますか？'
          initialInputs={[{ value: "文章を入力してください" }]}
          onInputChange={handleAssumptionChange}
        />
        <br></br>
        <br></br>
        {selectedType === 'misDeed' ? (
          <>
            <StaticTextInput
              row={3}
              title='健常行動ブレイクポイント'
              description='上で記述した状況がどのような点でアウトだったのかの説明です。 できる範囲で構わないので、なるべく理由は深堀りしてください。 「マナーだから」は理由としては認められません。 健常者エミュレータはマナー講師ではありません。一つずつ追加してください。3つ記入する必要はありません。'
              onInputChange={handleReflectionChange}
            />
            <StaticTextInput
              row={3}
              title='どうすればよかったか'
              description='5W1H状況説明、健常行動ブレイクポイントを踏まえ、どのようにするべきだったかを提示します。'
              onInputChange={handleCounterFactualReflectionChange}
            />
          </>
        ) : (
          <>
            <StaticTextInput
              row={3}
              title='なぜやってよかったのか'
              description='上で記述した行動がなぜやってよかったのか、理由を説明します。できる範囲で構わないので、なるべく理由は深堀りしてください。なんとなくただ「よかった」は理由としては認められません。一つずつ追加してください。3つ記入する必要はありません。'
              onInputChange={handleReflectionChange}
            />
            <StaticTextInput
              row={3}
              title='やらなかったらどうなっていたか'
              description='仮に上で記述した行動を実行しなかった場合、どのような不利益が起こりうるか記述してください。推論の範囲内で構いません。'
              onInputChange={handleCounterFactualReflectionChange}
            />
          </>
        )}
        <StaticTextInput
          row={3}
          title='備考'
          description='書ききれなかったことを書きます'
          onInputChange={handleNoteChange}
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
        />
        <TagSelectionBox onTagsSelected={handleTagSelection} createdTags={createdTags}/>
        <br></br>
        <TagCreateBox onTagCreated={handleTagCreated} onTagRemoved={handleTagRemoved} /> 
        <TagPreviewBox selectedTags={selectedTags} />
        <SubmitContentBox
          situationValues={situationValues}
          assumptionValues={assumptionValues}
          reflectionValues={reflectionValues}
          counterFactualReflectionValues={counterFactualReflectionValues}
          noteValues={noteValues}
          titleValues={titleValues}
          selectedType={selectedType}
          selectedTags={selectedTags}
        />
      </div>
      
    </div>
  )
}

export default App