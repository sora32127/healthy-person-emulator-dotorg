import { useEffect, useState } from "react";
import { MdOutlineLightMode, MdOutlineDarkMode } from "react-icons/md";

export default function ThemeSwitcher() {
  const [nowTheme, setNowTheme] = useState<string>();

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
    const newTheme = nowTheme === "dark" ? "light" : "dark";
    window.localStorage.setItem("theme", newTheme);
    setNowTheme(newTheme);
    document.querySelector("html")?.setAttribute("data-theme", newTheme);
  };

  return (
    <div className="tooltip tooltip-bottom" data-tip={nowTheme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}>
      <button onClick={toggleTheme} type="button" className="btn btn-ghost">
        {nowTheme === "dark" ? <MdOutlineLightMode className="w-6 h-6" /> : <MdOutlineDarkMode className="w-6 h-6" />}
      </button>
    </div>
  );
}