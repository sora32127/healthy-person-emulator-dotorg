import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

interface ComponentProps {
  className?: string;
  parentComponentStateValue: string;
  onInputChange: (value: string) => void;
}

export default function TextInputBoxAI({
  className = "",
  parentComponentStateValue,
  onInputChange,
}: ComponentProps) {
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const textarea = useRef<HTMLDivElement>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const composing = useRef<boolean>(false);

  const resetSuggestions = () => {
    setSuggestions(null);
  };

  const caretToLast = (element: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const handleInputValue = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      if (composing.current) return;
      if (timer.current) {
        clearTimeout(timer.current);
      }

      if (e.currentTarget.innerText) {
        const text = e.currentTarget.innerText;

        timer.current = setTimeout(async () => {
          try {
            const formData = new FormData();
            formData.append("text", text);
            const response = await fetch("/api/ai/getCompletion", {
              method: "POST",
              body: formData,
            });
            const suggestion = await response.json();
            setSuggestions(suggestion);
          } catch (e) {
            console.error(e);
          }
        }, 1000);
      } else {
        setSuggestions("");
      }
      onInputChange(e.currentTarget.innerText);
      caretToLast(e.currentTarget);
    },
    [onInputChange]
  );

  const handleCompositionStart = useCallback(() => {
    composing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      composing.current = false;
      handleInputValue(e);
    },
    [handleInputValue]
  );

  const commitSuggestions = () => {
    const textareaElement = textarea.current;
    if (textareaElement && suggestions) {
      const newValue = textareaElement.innerText + suggestions;
      textareaElement.innerText = newValue;
      caretToLast(textareaElement);
      resetSuggestions();
      onInputChange(newValue);
    }
  };

  const handleSuggestions = (e: KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      commitSuggestions();
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

  return (
    <div className={className}>
      <div
        contentEditable
        suppressHydrationWarning={true}
        ref={textarea}
        onInput={handleInputValue}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        className="w-full border-2 border-gray-300 rounded-lg p-2"
      >
        {parentComponentStateValue}
      </div>
      {suggestions && (
        <>
          <p className="text-base-content mt-2">[補完候補]: {suggestions}</p>
          <p className="text-base-content mt-2">
            Tabキーまたはボタンを押して補完できます。
          </p>
          <button
            onClick={commitSuggestions}
            className="bg-primary text-white font-bold py-2 px-4 rounded mt-2"
          >
            補完する
          </button>
        </>
      )}
    </div>
  );
}
