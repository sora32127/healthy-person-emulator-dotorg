import { useState, useEffect } from 'react';
import { Sun, Moon, Loader } from 'lucide-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { getThemeAtom, toggleThemeAtom } from '../stores/theme';

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
    // entry.server.tsxが注入したハイドレーション保護用MutationObserverを切断する
    if ((window as any).__themeObserver) {
      (window as any).__themeObserver.disconnect();
      delete (window as any).__themeObserver;
    }
    document.documentElement.setAttribute('data-theme', nowTheme);
    document.documentElement.classList.remove('theme-transition');
  }, [nowTheme]);

  return (
    <button
      onClick={handleToggleTheme}
      type="button"
      className="btn btn-ghost h-9 w-9 p-0"
      aria-label="テーマ切替"
    >
      {isChanging ? (
        <Loader className="w-5 h-5 animate-spin" />
      ) : nowTheme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
