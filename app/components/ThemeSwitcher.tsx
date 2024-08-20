import { useEffect, useState } from "react";
import { MdOutlineLightMode, MdOutlineDarkMode } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

export default function ThemeSwitcher() {
  const [nowTheme, setNowTheme] = useState<string>();
  const [isChanging, setIsChanging] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("theme") === null) {
      const initialTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      window.localStorage.setItem("theme", initialTheme);
    }
    const theme = window.localStorage.getItem("theme") || "dark";
    setNowTheme(theme);
    document.querySelector("html")?.setAttribute("data-theme", theme);
  }, []);

  const toggleTheme = () => {
    setIsChanging(true);
    const newTheme = nowTheme === "dark" ? "light" : "dark";
    window.localStorage.setItem("theme", newTheme);
    setNowTheme(newTheme);
    document.querySelector("html")?.setAttribute("data-theme", newTheme);
    setTimeout(() => setIsChanging(false), 500);
    setTimeout(() => setIsChanging(false), 500);
  };

  return (
    <div className="tooltip tooltip-bottom" data-tip={nowTheme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}>
      <button
        onClick={toggleTheme}
        type="button"
        className={`btn btn-circle ml-1 mt-1 ${isChanging ? "animate-spin" : ""}`}
      >
        {isChanging ? (
          <AiOutlineLoading3Quarters className="w-6 h-6 animate-spin" />
        ) : nowTheme === "dark" ? (
          <MdOutlineLightMode className="w-6 h-6" />
        ) : (
          <MdOutlineDarkMode className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}