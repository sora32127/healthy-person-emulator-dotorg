import './App.css'
import ThemeSwitcher from './ThemeSwitcher'
import { useEffect, useState } from 'react';
import DynamicTextInput from './DynamicTextInput';

function App() {

  return (
    <>
      <ThemeSwitcher />
      <DynamicTextInput description = "AA" inputs={[{ placeholder: "AAA" }, { placeholder: "BBB" }]} />
    </>
  )
}

export default App
