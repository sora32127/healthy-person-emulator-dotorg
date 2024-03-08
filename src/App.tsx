import './App.css'
import { useState, useEffect } from 'react';
import DynamicTextInput from './DynamicTextInput';
import TagSelectionBox from './TagSelectionBox';
import SituationInput from './SituationInput';
import TopBar from './TopBar';
import StaticTextInput from './StaticTextInput';
import Preview from './Preview';
import TagPreviewBox from './TagPreviewBox';
import TagCreateBox from './TagCreateBox';
import SubmitContentBox from './SubmitContentBox';

/*
TODO
- ローカルストレージの値をクリアするボタンの追加
- 説明書きの追加
- CSSの最終調整
- 最終ハッピーパステスト
- 本番公開
*/
function App() {

  const [ situationValues, setSituationValues] = useState<{ [key: string]: string }>( () => {
    const saved = localStorage.getItem('situation');
    const initialValue = JSON.parse(saved || '{}');
    return initialValue;
  });
  const handleSituationChange = (values: { [key: string]: string }) => {
      setSituationValues(values);
      localStorage.setItem('situationValue', JSON.stringify(values));
  };

  const [assumptionValues, setAssumptionValues] = useState<string[]>( () => {
    const saved = localStorage.getItem('assumptionValue');
    const initialValue = JSON.parse(saved || '[]');
    return initialValue;
  });
  const handleAssumptionChange = (values: string[]) => {
      setAssumptionValues(values);
      localStorage.setItem('assumptionValue', JSON.stringify(values));
  };

  const [reflectionValues, setReflectionValues] = useState<string[]>( () => {
    const saved = localStorage.getItem('reflectionValue');
    const initialValue = JSON.parse(saved || '[]');
    return initialValue;
  });
  const handleReflectionChange = (values: string[]) => {
      setReflectionValues(values);
      localStorage.setItem('reflectionValue', JSON.stringify(values));
  }

  const [counterFactualReflectionValues, setCounterFactualReflectionValues] = useState<string[]>( () => {
    const saved = localStorage.getItem('counterFactualReflectionValue');
    const initialValue = JSON.parse(saved || '[]');
    return initialValue;
  
  });
  const handleCounterFactualReflectionChange = (values: string[]) => {
      setCounterFactualReflectionValues(values);
      localStorage.setItem('counterFactualReflectionValue', JSON.stringify(values));
  }

  const [noteValues, setNoteValues] = useState<string[]>( () => {
    const saved = localStorage.getItem('noteValue');
    const initialValue = JSON.parse(saved || '[]');
    return initialValue;
  });
  const handleNoteChange = (values: string[]) => {
      setNoteValues(values);
      localStorage.setItem('noteValue', JSON.stringify(values));
  }

  const [titleValues, setTitleValues] = useState<string[]>( () => {
    const saved = localStorage.getItem('titleValue');
    const initialValue = JSON.parse(saved || '[]');
    return initialValue;
  });
  const handleTitleChange = (values: string[]) => {
      setTitleValues(values);
      localStorage.setItem('titleValue', JSON.stringify(values));
  }

  const [selectedType, setSelectedType] = useState<string>( () => {
    const saved = localStorage.getItem('selectedType');
    const initialValue = saved || 'misDeed';
    return initialValue;
  });
  const handleToggle = (selectedType: string) => {
      setSelectedType(selectedType);
      localStorage.setItem('selectedType', selectedType);
  }

  const [selectedTags, setSelectedTags] = useState<string[]>( () => {
    const saved = localStorage.getItem('selectedTags');
    const initialValue = JSON.parse(saved || '[]');
    return initialValue;
  });
  const handleTagSelection = (tags: string[]) => {
    setSelectedTags(tags);
    localStorage.setItem('selectedTags', JSON.stringify(tags));
  }

  const [createdTags, setCreatedTags] = useState<string[]>( () => {
    const saved = localStorage.getItem('createdTags');
    const initialValue = JSON.parse(saved || '[]');
    return initialValue;
  });
  useEffect(() => {
    localStorage.setItem('createdTags', JSON.stringify(createdTags));
  }, [createdTags]);
  
  const handleTagCreated = (tag: string) => {
    setCreatedTags((prevCreatedTags) => [...prevCreatedTags, tag]);
  };
  
  const handleTagRemoved = (tag: string) => {
    setCreatedTags(createdTags.filter(createdTag => createdTag !== tag));
  };

  const clearInputs = () => {
    console.log("CLEARBUTTON")
    setSituationValues({});
    setAssumptionValues([]);
    setReflectionValues([]);
    setCounterFactualReflectionValues([]);
    setNoteValues([]);
    setTitleValues([]);
    setSelectedType('misDeed');
    setSelectedTags([]);
    setCreatedTags([]);
    localStorage.clear()
  };



  return (
    <div>
      <TopBar onToggle={handleToggle} clearInputs={clearInputs} />
      <div className='main-campus'>
        <br></br>
        <br></br>
        <br></br>
        <SituationInput
          onInputChange={handleSituationChange}
          parentComponentStateValues={situationValues}
        />
        <br></br>
        <br></br>
        <DynamicTextInput
          description='書ききれなかった前提条件はありますか？'
          initialInputs={[{ value: "文章を入力してください" }]}
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
              description='上で記述した状況がどのような点でアウトだったのかの説明です。 できる範囲で構わないので、なるべく理由は深堀りしてください。 「マナーだから」は理由としては認められません。 健常者エミュレータはマナー講師ではありません。一つずつ追加してください。3つ記入する必要はありません。'
              onInputChange={handleReflectionChange}
              parentComponentStateValues={reflectionValues}
            />
            <StaticTextInput
              row={3}
              title='どうすればよかったか'
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
              description='上で記述した行動がなぜやってよかったのか、理由を説明します。できる範囲で構わないので、なるべく理由は深堀りしてください。なんとなくただ「よかった」は理由としては認められません。一つずつ追加してください。3つ記入する必要はありません。'
              onInputChange={handleReflectionChange}
              parentComponentStateValues={reflectionValues}
            />
            <StaticTextInput
              row={3}
              title='やらなかったらどうなっていたか'
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
        />
        <br></br>
        <TagCreateBox
          handleTagCreated={handleTagCreated}
          handleTagRemoved={handleTagRemoved}
          parentComponentStateValues={createdTags}
        /> 
        <TagPreviewBox selectedTags={selectedTags} createdTags={createdTags}/>
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