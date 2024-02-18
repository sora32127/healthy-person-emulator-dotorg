import { useEffect, useState } from "react";

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
        <button onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
        </button>        
    )
}

export default ThemeSwitcher;