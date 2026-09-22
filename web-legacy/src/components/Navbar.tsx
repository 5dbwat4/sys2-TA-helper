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
      <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400">
        <a href="/dashboard">TA System</a>
      </h1>

      <nav className="space-x-4">
        <a href="/dashboard" className="hover:text-blue-500 transition-colors">Dashboard</a>
        <a href="/experiments" className="hover:text-blue-500 transition-colors">Experiments</a>
        {role === "TA" && (
          <a href="/checkoff" className="hover:text-emerald-500 font-semibold transition-colors">Checkoff</a>
        )}
        {role === "TA" && (
          <a href="/assignments" className="hover:text-blue-500 transition-colors">Assignments</a>
        )}
        <a href="/boards" className="hover:text-blue-500 transition-colors">Boards</a>
      </nav>

      <div className="flex items-center space-x-3">
        <span className="text-sm opacity-80">{userName}</span>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="px-4 py-2 rounded-full glass hover:bg-white/20 transition-colors shadow-sm text-sm"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
