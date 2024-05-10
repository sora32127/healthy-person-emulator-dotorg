import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

interface ComponentProps {
  id: string;
  className?: string;
  parentComponentStateValue: string;
  onInputChange: (value: string) => void;
  placeholder?: string;
  prompt?: string;
}

export default function TextInputBoxAI({
  id = "",
  className = "",
  parentComponentStateValue,
  onInputChange,
  placeholder = "",
  prompt = "",
}: ComponentProps) {
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const resetSuggestions = () => {
    setSuggestions(null);
  };

  const handleInputValue = useCallback(
    (e: FormEvent<HTMLTextAreaElement>) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }

      if (e.currentTarget.value) {
        const text = e.currentTarget.value;

        timer.current = setTimeout(async () => {
          try {
            const formData = new FormData();
            formData.append("text", text);
            formData.append("context", createContextSentence());
            formData.append("prompt", prompt);
            const response = await fetch("/api/ai/getCompletion", {
              method: "POST",
              body: formData,
            });
            const suggestions = await response.json();
            setSuggestions(suggestions);
          } catch (e) {
            console.error(e);
          }
        }, 1000);
      } else {
        setSuggestions([]);
      }
      onInputChange(e.currentTarget.value);
    },
    [onInputChange]
  );

  const commitSuggestion = (index: number) => {
    const textareaElement = textarea.current;
    if (textareaElement && suggestions && suggestions[index]) {
      const newValue = textareaElement.value + suggestions[index];
      textareaElement.value = newValue;
      textareaElement.focus();
      resetSuggestions();
      onInputChange(newValue);
    }
  };

  const handleSuggestions = (e: KeyboardEvent) => {
    if (e.shiftKey) {
      const keys = ["1", "2"];
      const inputKey = keys.find((key) => e.code.endsWith(key));
      if (inputKey && suggestions) {
        const inputNumber = parseInt(inputKey);
        if (inputNumber >= 1 && inputNumber <= suggestions.length) {
          e.preventDefault();
          commitSuggestion(inputNumber - 1);
        }
      }
    }
  };

  useEffect(() => {
    if (suggestions) {
      addEventListener("keydown", handleSuggestions);
      addEventListener("click", resetSuggestions);
    }
    return () => {
      removeEventListener("keydown", handleSuggestions);
      removeEventListener("click", resetSuggestions);
    };
  }, [suggestions]);

  const getContextFromLocalStorage = () => {
    const situationValue = window.localStorage.getItem("situationValue");
    const reflectionValue = window.localStorage.getItem("reflectionValue");
    const counterReflectionValue = window.localStorage.getItem("counterReflectionValue");
    const noteValue = window.localStorage.getItem("noteValue");
    return {
      situationValue,
      reflectionValue,
      counterReflectionValue,
      noteValue,
    };
  };

  const createContextSentence = () => {
    const contextValues = getContextFromLocalStorage();
    const contextSetense = `以下のテキストはコンテキストを表すものです。文章を補完する際の参考にしてください。状況: ${contextValues.situationValue}。反省: ${contextValues.reflectionValue}。反省に対する反省: ${contextValues.counterReflectionValue}。メモ: ${contextValues.noteValue}。`;
    return contextSetense;
  };

  return (
    <div className={className}>
      <textarea
        id={id}
        ref={textarea}
        value={parentComponentStateValue}
        onChange={handleInputValue}
        placeholder={placeholder}
        className="w-full border-2 border-base-content rounded-lg p-2 placeholder-slate-500"
      />
      {suggestions && (
        <>
          <p className="text-base-content mt-2">
            [補完候補]:
            {suggestions.map((suggestion, index) => (
              <span key={index} className="mr-2">
                [{index + 1}] {suggestion}
              </span>
            ))}
          </p>
          <p className="text-info mt-2">
            Shift + 1 を押すと1つ目の補完候補が、Shift + 2 を押すと2つ目の補完候補がコミットされます。
          </p>
        </>
      )}
    </div>
  );
}