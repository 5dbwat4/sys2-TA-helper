"use client";

import { useEffect, useState } from "react";

import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar({
  initialRole,
  initialUserName,
}: {
  initialRole?: string | null;
  initialUserName?: string | null;
}) {
  const [role, setRole] = useState<string | null>(initialRole || null);
  const [userName, setUserName] = useState<string | null>(initialUserName || null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // Keep in sync with session API to guarantee fresh state even with browser bfcache
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setRole(data.user.role);
          setUserName(data.user.name || data.user.studentId);
        } else {
          setRole(null);
          setUserName(null);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/api/auth/logout';
  };

  // Only render for TA and TEACHER
  if (role !== "TA" && role !== "TEACHER") {
    return null;
  }

  return (
    <header className="glass m-4 p-4 sticky top-4 z-50 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400">
          <a href="/dashboard">
            {role === "TEACHER" ? "Teacher Portal" : "TA System"}
          </a>
        </h1>
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${role === "TEACHER" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"}`}>
          {role === "TEACHER" ? "教师端" : "助教端"}
        </span>
      </div>

      <nav className="flex items-center space-x-3 sm:space-x-5 text-sm font-medium">
        <a href="/dashboard" className="hover:text-blue-400 transition-colors">Dashboard</a>
        <a href="/experiments" className="hover:text-blue-400 transition-colors">Experiments</a>
        {role === "TA" && (
          <a href="/checkoff" className="hover:text-emerald-400 font-semibold transition-colors">Checkoff</a>
        )}
        <a href="/assignments" className="hover:text-amber-400 transition-colors">
          {role === "TEACHER" ? "Assignments (查看)" : "Assignments"}
        </a>
        <a href="/quizzes" className="hover:text-purple-400 font-semibold transition-colors">Quizzes</a>
        <a href="/boards" className="hover:text-teal-400 transition-colors">Boards</a>
      </nav>

      <div className="flex items-center space-x-3">
        <span className="text-sm opacity-90 hidden sm:inline-block font-medium">
          {userName} {role === "TEACHER" && "老师"}
        </span>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="px-3.5 py-1.5 rounded-full glass hover:bg-white/20 transition-colors shadow-sm text-xs font-medium"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
