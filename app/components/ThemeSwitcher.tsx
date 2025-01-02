import { useState, useEffect } from "react";
import { Sun, Moon, Loader } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { getThemeAtom, toggleThemeAtom } from "../stores/theme";

export default function ThemeSwitcher() {
  const nowTheme = useAtomValue(getThemeAtom);
  const toggleTheme = useSetAtom(toggleThemeAtom);
  const [isChanging, setIsChanging] = useState(false);

  const handleToggleTheme = () => {
    setIsChanging(true);
    document.documentElement.classList.add('theme-transition');
    toggleTheme();
    setTimeout(() => {
      setIsChanging(false);
      document.documentElement.classList.remove('theme-transition');
    }, 500);
  };

  useEffect(() => {
    document.documentElement.classList.remove('theme-transition');
  }, []);

  return (
    <button
      onClick={handleToggleTheme}
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