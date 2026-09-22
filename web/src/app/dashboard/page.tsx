"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import ThemeToggle from "@/components/ThemeToggle";

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [passkeyMsg, setPasskeyMsg] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setSession(data.user);
          if (data.user.role === 'STUDENT') {
            fetch('/api/student/dashboard')
              .then(res => res.json())
              .then(sData => {
                if (sData.success) {
                  setStudentData(sData);
                }
                setLoading(false);
              })
              .catch(() => setLoading(false));
          } else {
            setLoading(false);
          }
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const registerPasskey = async () => {
    setPasskeyMsg("");
    setPasskeyLoading(true);
    try {
      const resp = await fetch("/api/auth/passkey/generate-registration");
      if (!resp.ok) {
        throw new Error("Failed to generate registration options");
      }
      const options = await resp.json();
      
      const attResp = await startRegistration({ optionsJSON: options });
      
      const verificationResp = await fetch("/api/auth/passkey/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      });
      
      const verificationResult = await verificationResp.json();
      if (verificationResult.verified) {
        setPasskeyMsg("✅ 通行密钥 (Passkey) 注册成功！下次登录可直接使用指纹/面容免密秒登。");
      } else {
        setPasskeyMsg("❌ 校验失败: " + (verificationResult.error || "未知错误"));
      }
    } catch (err: any) {
      console.error(err);
      setPasskeyMsg("❌ 注册失败: " + err.message);
    }
    setPasskeyLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  if (!session) return null;

  // -------------------------------------------------------------
  // STUDENT DASHBOARD VIEW
  // -------------------------------------------------------------
  if (session.role === "STUDENT") {
    const board = studentData?.board;
    const grades = studentData?.grades || [];

    return (
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Student Welcome Header */}
        <div className="glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                学生端
              </span>
              {studentData?.student?.hasCheckpoint && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  已申领 Checkpoint
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mt-2">
              欢迎回来，{studentData?.student?.name || session.studentId}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              学号: <span className="font-mono text-zinc-200">{session.studentId}</span> | 课程: 计算机系统Ⅱ (CS2052M)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="/api/auth/logout"
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-zinc-300 transition border border-white/10"
            >
              退出登录
            </a>
          </div>
        </div>

        {/* Board Assignment Section */}
        <div className="glass p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              开发板绑定信息
            </h2>
            {board && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${board.isReturned ? 'bg-zinc-500/20 text-zinc-400' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                {board.isReturned ? "已归还" : "借用中"}
              </span>
            )}
          </div>

          {board ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-zinc-400 block mb-1">资产编号 (Asset No)</span>
                <span className="text-lg font-mono font-bold text-sky-400">{board.assetNo}</span>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-zinc-400 block mb-1">DB 编号</span>
                <span className="text-lg font-mono font-bold text-teal-400">{board.dbNo}</span>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-zinc-400 block mb-1">借用登记时间</span>
                <span className="text-sm text-zinc-300 font-mono">
                  {board.assignedAt ? new Date(board.assignedAt).toLocaleDateString() : "-"}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-zinc-400 block mb-1">组内成员</span>
                <div className="text-sm font-medium text-zinc-200 truncate">
                  {board.teamMembers && board.teamMembers.length > 0
                    ? board.teamMembers.join(", ")
                    : "独立实验"}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-white/5 border border-white/10 text-zinc-400">
              暂未绑定开发板。如有实验需要，请前往实验课现场向助教扫码借用。
            </div>
          )}
        </div>

        {/* Experiment Grades Section */}
        <div className="glass p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
              实验成绩与批改详情
            </h2>
            <div className="flex items-center gap-3">
              {studentData?.courseSummary && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  当前实验总评已得: {studentData.courseSummary.totalEarned} / {studentData.courseSummary.maxPossible} 分
                </span>
              )}
              <span className="text-xs text-zinc-400">共 {grades.length} 项实验</span>
            </div>
          </div>

          {grades.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">暂无已发布的实验课程</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {grades.map((item: any) => {
                const sub = item.submission;
                const isGraded = item.status === 'GRADED';

                return (
                  <div key={item.experimentId} className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-sky-500/20 text-sky-300">
                          {item.experimentNumber}
                        </span>
                        <h3 className="text-lg font-semibold text-zinc-100">{item.experimentName}</h3>
                        <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-white/5">
                          {item.type === 'HARDWARE' ? '硬件实验' : item.type === 'SOFTWARE' ? '软件实验' : '综合实验'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 space-x-3">
                        <span>截止时间: {new Date(item.dueDate).toLocaleDateString()}</span>
                        <span>|</span>
                        <span>权重: 验收 ({item.acceptanceRatio * 100}%) / 报告 ({item.reportRatio * 100}%) / 代码 ({item.codeRatio * 100}%)</span>
                        <span>|</span>
                        <span className="text-blue-300 font-semibold">总评占比: {item.courseWeight} 分</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {sub?.checkpointClaimed ? (
                        <div className="flex items-center gap-6">
                          <div className="text-right space-y-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-block">
                              申领了 Checkpoint
                            </span>
                            <div className="text-xs text-amber-400 font-medium">
                              0分原因：申领了Checkpoint（免做本次实验）
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center min-w-[90px]">
                            <span className="text-xs text-amber-400 block font-medium">实验总分</span>
                            <span className="text-xl font-bold font-mono text-amber-300">
                              0 <span className="text-xs font-normal">/ 100</span>
                            </span>
                            <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                              总评: 0 / {item.courseWeight}分
                            </div>
                          </div>
                        </div>
                      ) : isGraded ? (
                        <div className="flex items-center gap-6">
                          <div className="text-xs text-zinc-400 space-y-1 text-right">
                            <div>验收: <span className="text-zinc-200 font-mono font-semibold">{sub.acceptanceScore ?? "-"}</span> / {item.totalScore * item.acceptanceRatio}</div>
                            <div>报告: <span className="text-zinc-200 font-mono font-semibold">{sub.reportScore ?? "-"}</span> / {item.totalScore * item.reportRatio}</div>
                            <div>代码: <span className="text-zinc-200 font-mono font-semibold">{sub.codeScore ?? "-"}</span> / {item.totalScore * item.codeRatio}</div>
                            {(sub.reportPenalty > 0 || sub.codePenalty > 0) && (
                              <div className="text-red-400">罚分: -{(sub.reportPenalty || 0) + (sub.codePenalty || 0)}</div>
                            )}
                            {sub.isPlagiarised && (
                              <div className="text-amber-400 font-bold">⚠️ 查重告警</div>
                            )}
                          </div>
                          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-center min-w-[90px]">
                            <span className="text-xs text-sky-400 block font-medium">实验总分</span>
                            <span className="text-xl font-bold font-mono text-sky-300">
                              {sub.finalScore ?? 0} <span className="text-xs font-normal">/ 100</span>
                            </span>
                            <div className="text-[10px] text-emerald-400 mt-0.5 font-mono font-bold">
                              总评: {item.courseScore ?? 0} / {item.courseWeight}分
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-2 rounded-lg bg-white/5 text-zinc-400 text-sm">
                          暂未批改
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // TA / TEACHER DASHBOARD VIEW
  // -------------------------------------------------------------
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* TA Header */}
      <div className="glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            助教管理台
          </span>
          <h1 className="text-3xl font-bold mt-2">工作台概览</h1>
          <p className="text-sm text-zinc-400 mt-1">
            登录身份: {session.name || session.studentId} ({session.studentId})
          </p>
        </div>
      </div>

      {/* Security & Passkey Management (TA Only) */}
      <div className="glass p-6 rounded-2xl space-y-4 border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-sky-500/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">通行密钥安全设置 (Passkey)</h2>
            <p className="text-sm text-zinc-400">
              录入设备的生物识别（Touch ID / Face ID / Windows Hello），下次可直接免密一键登录助教系统。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={registerPasskey}
            disabled={passkeyLoading}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {passkeyLoading ? "正在调起生物识别..." : "登记当前设备通行密钥 (Register Passkey)"}
          </button>
        </div>
        {passkeyMsg && (
          <div className="p-3 rounded-xl bg-white/10 text-sm font-medium border border-white/10">
            {passkeyMsg}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a href="/experiments" className="glass p-6 rounded-2xl hover:border-sky-500/50 hover:bg-white/10 transition group">
          <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 w-fit mb-4 group-hover:scale-110 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">新增与发布实验</h2>
          <p className="text-sm text-zinc-400 mt-2">创建新实验、设定成绩权重与截止日期、编写思考题。</p>
        </a>

        <a href="/assignments" className="glass p-6 rounded-2xl hover:border-amber-500/50 hover:bg-white/10 transition group">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 w-fit mb-4 group-hover:scale-110 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">批改作业与查重</h2>
          <p className="text-sm text-zinc-400 mt-2">录入验收分、报告与代码成绩，支持调用 sim_c++ 快速查重。</p>
        </a>

        <a href="/boards" className="glass p-6 rounded-2xl hover:border-teal-500/50 hover:bg-white/10 transition group">
          <div className="p-3 rounded-xl bg-teal-500/20 text-teal-400 w-fit mb-4 group-hover:scale-110 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">实验板管理</h2>
          <p className="text-sm text-zinc-400 mt-2">登记学生扫码借还，自动向钉钉群推送板子借还动态。</p>
        </a>
      </div>
    </div>
  );
}
