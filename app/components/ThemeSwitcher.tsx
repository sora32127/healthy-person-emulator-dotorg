import { useEffect, useState } from "react";

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
    const newTheme = nowTheme == "dark" ? "light" : "dark";
    window.localStorage.setItem("theme", newTheme);
    setNowTheme(newTheme);
    document.querySelector("html")?.setAttribute("data-theme", newTheme);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="theme-switcher">
        <span className="sr-only">テーマ切り替え</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      </label>
      <input
        type="checkbox"
        id="theme-switcher"
        checked={nowTheme == "dark"}
        onChange={toggleTheme}
        className="toggle theme-controller"
      />
      <label htmlFor="theme-switcher">
        <span className="sr-only">ダークモード</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </label>
    </div>
  );
}