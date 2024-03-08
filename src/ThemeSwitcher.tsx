import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import DarkModeIcon from "./assets/dark_mode_icon.svg";
import LightModeIcon from "./assets/light_mode_icon.svg";

const ThemeSwitcher = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  }

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme])

  return (
    <Button variant="primary" onClick={toggleTheme}>
      {theme === 'light' ? (
        <img src={DarkModeIcon} alt="Switch to Dark Mode" style={{ width: '24px', height: '24px' }} />
      ) : (
        <img src={LightModeIcon} alt="Switch to Light Mode" style={{ width: '24px', height: '24px' }} />
      )}
    </Button>        
  )
}

export default ThemeSwitcher;