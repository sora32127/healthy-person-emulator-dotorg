import { useEffect, useState } from "react";
import { Sun, Moon, Loader } from "lucide-react";

export default function ThemeSwitcher() {
  const [nowTheme, setNowTheme] = useState<string>();
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
  };

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="btn btn-ghost h-9 w-9 p-0"
    >
      {isChanging ? (
        <Loader className="w-5 h-5 animate-spin" />
      ) : nowTheme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}