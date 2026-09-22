"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      applyTheme(initial);
    }

    const handleThemeChange = () => {
      const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
      setTheme(current);
    };

    window.addEventListener("themechange", handleThemeChange);
    return () => window.removeEventListener("themechange", handleThemeChange);
  }, []);

  const applyTheme = (t: "light" | "dark") => {
    if (t === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
    window.dispatchEvent(new Event("themechange"));
  };

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl glass flex items-center justify-center opacity-70 ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl glass hover:bg-white/20 transition-all flex items-center justify-center gap-1.5 text-xs font-medium border shadow-sm ${className}`}
      title={theme === "dark" ? "当前为深色模式，点击切换为浅色模式" : "当前为浅色模式，点击切换为深色模式"}
    >
      {theme === "dark" ? (
        <>
          <span className="text-amber-300 text-sm">🌙</span>
          <span className="hidden sm:inline opacity-80">深色</span>
        </>
      ) : (
        <>
          <span className="text-amber-500 text-sm">☀️</span>
          <span className="hidden sm:inline opacity-80">浅色</span>
        </>
      )}
    </button>
  );
}
