"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import ThemeToggle from "@/components/ThemeToggle";

function LoginForm() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role") || "student";
  const [role, setRole] = useState(roleParam);
  
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  
  // Teacher credentials
  const [teacherUsername, setTeacherUsername] = useState("吴磊");
  const [teacherPassword, setTeacherPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name, role: "student" }),
      });
      if (resp.ok) {
        window.location.href = "/dashboard";
      } else {
        const err = await resp.json();
        setErrorMsg(err.error);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
    setLoading(false);
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "teacher",
          username: teacherUsername,
          password: teacherPassword,
        }),
      });
      if (resp.ok) {
        window.location.href = "/dashboard";
      } else {
        const err = await resp.json();
        setErrorMsg(err.error || "教师登录失败");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
    setLoading(false);
  };

  const handlePasskeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const resp = await fetch("/api/auth/passkey/generate-authentication");
      if (!resp.ok) throw new Error("Failed to get authentication options");
      const options = await resp.json();

      const asseResp = await startAuthentication({ optionsJSON: options });
      
      const verificationResp = await fetch("/api/auth/passkey/verify-authentication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asseResp),
      });

      const verificationResult = await verificationResp.json();
      if (verificationResult.verified) {
        window.location.href = "/dashboard";
      } else {
        setErrorMsg("Passkey 验证失败: " + verificationResult.error);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("错误: " + err.message);
    }
    setLoading(false);
  };

  const handleZJUAMLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !password) {
      setErrorMsg("请输入浙大学号和密码。");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const resp = await fetch("/api/auth/zjuam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, password }),
      });
      if (resp.ok) {
        window.location.href = "/dashboard";
      } else {
        const err = await resp.json();
        setErrorMsg(err.error || "ZJUAM 登录失败");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 relative">
      <div className="absolute top-4 right-4 md:top-6 md:right-6">
        <ThemeToggle />
      </div>
      <div className="glass p-8 max-w-md w-full space-y-6">
        <h2 className="text-3xl font-bold text-center">
          {role === "teacher" ? "教师端登录" : role === "ta" ? "助教端登录" : "学生端登录"}
        </h2>
        
        {/* Role Tabs */}
        <div className="flex justify-center space-x-2 mb-6">
          <button 
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${role === 'student' ? 'bg-sky-500 text-white shadow' : 'glass hover:bg-white/10 text-zinc-300'}`}
            onClick={() => { setRole("student"); setErrorMsg(""); }}
          >
            学生 (Student)
          </button>
          <button 
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${role === 'ta' ? 'bg-purple-600 text-white shadow' : 'glass hover:bg-white/10 text-zinc-300'}`}
            onClick={() => { setRole("ta"); setErrorMsg(""); }}
          >
            助教 (TA)
          </button>
          <button 
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${role === 'teacher' ? 'bg-emerald-600 text-white shadow' : 'glass hover:bg-white/10 text-zinc-300'}`}
            onClick={() => { setRole("teacher"); setErrorMsg(""); }}
          >
            教师 (Teacher)
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/20 border border-red-500 text-red-300 rounded-xl text-sm">
            {errorMsg}
          </div>
        )}

        {/* 1. STUDENT LOGIN */}
        {role === "student" && (
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-300">学号 (Student ID)</label>
              <input 
                type="text" 
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="例如: 325010xxxx"
                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500 text-zinc-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-300">姓名 (Name)</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="输入真实姓名"
                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500 text-zinc-100"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2.5 bg-sky-500 text-white rounded-xl shadow font-semibold hover:bg-sky-600 disabled:opacity-50 transition"
            >
              {loading ? "正在登录..." : "进入学生端"}
            </button>
          </form>
        )}

        {/* 2. TA LOGIN */}
        {role === "ta" && (
          <div className="space-y-4">
            <button 
              onClick={handlePasskeyLogin}
              disabled={loading}
              className="w-full py-3 bg-purple-600 text-white rounded-xl shadow hover:bg-purple-700 flex items-center justify-center space-x-2 disabled:opacity-50 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>通行密钥一键免密登录 (Passkey)</span>
            </button>
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-zinc-400 text-xs">或使用 ZJUAM 验证</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>
            
            <form onSubmit={handleZJUAMLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-300">助教学号</label>
                <input 
                  type="text" 
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="输入助教学号..."
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-300">ZJUAM 统一身份认证密码</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 text-zinc-100"
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow font-semibold disabled:opacity-50 transition"
              >
                {loading ? "正在验证..." : "登录助教端"}
              </button>
            </form>
          </div>
        )}

        {/* 3. TEACHER LOGIN */}
        {role === "teacher" && (
          <form onSubmit={handleTeacherLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-300">教师姓名</label>
              <select
                value={teacherUsername}
                onChange={e => setTeacherUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-100 text-base"
              >
                <option value="吴磊">吴磊 老师</option>
                <option value="卢立">卢立 老师</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-300">教师密码</label>
              <input 
                type="password" 
                value={teacherPassword}
                onChange={e => setTeacherPassword(e.target.value)}
                placeholder="请输入系统二教师固定密码"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-100"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow font-semibold disabled:opacity-50 transition"
            >
              {loading ? "正在登录..." : "登录教师端"}
            </button>
            <p className="text-xs text-center text-zinc-400 mt-2">
              教师密码已固定配置，如有遗忘请联系课程组助教。
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
