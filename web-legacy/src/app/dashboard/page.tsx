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

        {/* Experiment Grades & Quizzes Timeline Section */}
        <div className="glass p-6 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                课程实验与随堂小测
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                包含实验项目、现场验收记录与随堂小测，按发布时间排序
              </p>
            </div>
            <div className="flex items-center gap-3">
              {studentData?.courseSummary && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  当前总评已得: {studentData.courseSummary.totalEarned} / {studentData.courseSummary.maxPossible} 分
                </span>
              )}
              <span className="text-xs text-zinc-400">
                共 {(studentData?.timelineItems || grades).length} 项内容
              </span>
            </div>
          </div>

          {(studentData?.timelineItems || grades).length === 0 ? (
            <div className="p-8 text-center text-zinc-400">暂无发布的实验或随堂小测</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(studentData?.timelineItems || grades).map((item: any) => {
                // 1. QUIZ ITEM
                if (item.itemType === "QUIZ") {
                  const hasScore = item.score !== null && item.score !== undefined;

                  return (
                    <div
                      key={`quiz-${item.id}`}
                      className="p-5 rounded-xl bg-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 transition flex flex-col md:flex-row justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            随堂小测
                          </span>
                          <h3 className="text-lg font-semibold text-zinc-100">{item.name}</h3>
                        </div>
                        <div className="text-xs text-zinc-400 space-x-3 flex flex-wrap gap-y-1">
                          <span>进行日期: {new Date(item.publishDate).toLocaleDateString()}</span>
                          <span>|</span>
                          <span>基准满分: {item.totalScore}分</span>
                          <span>|</span>
                          <span className="text-purple-300 font-semibold">总评占比: {item.courseWeight} 分</span>
                          {item.remark && (
                            <>
                              <span>|</span>
                              <span className="text-zinc-300">备注: {item.remark}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {hasScore ? (
                          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center min-w-[110px]">
                            <span className="text-xs text-purple-300 block font-medium">小测成绩</span>
                            <span className="text-xl font-bold font-mono text-purple-200">
                              {item.score} <span className="text-xs font-normal text-zinc-400">/ {item.totalScore}</span>
                            </span>
                            <div className="text-[10px] text-emerald-400 mt-0.5 font-mono font-bold">
                              总评: {item.courseScore ?? 0} / {item.courseWeight}分
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-2 rounded-lg bg-white/5 text-zinc-400 text-xs text-center min-w-[110px]">
                            暂无登记成绩
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // 2. UNPUBLISHED EXPERIMENT ITEM
                if (!item.isPublished) {
                  return (
                    <div
                      key={`exp-unpub-${item.experimentId}`}
                      className="p-5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col md:flex-row justify-between gap-4 opacity-80"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-zinc-500/20 text-zinc-400 font-mono">
                            {item.experimentNumber}
                          </span>
                          <h3 className="text-lg font-semibold text-zinc-400 tracking-wide">
                            （实验内容尚未公开）
                          </h3>
                          <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-white/5">
                            {item.type === "HARDWARE" ? "硬件实验" : item.type === "SOFTWARE" ? "软件实验" : "综合实验"}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                            未发布
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 space-x-3 flex flex-wrap gap-y-1">
                          <span className="text-zinc-400">
                            预计发布: {new Date(item.publishDate).toLocaleDateString()}
                          </span>
                          <span>|</span>
                          <span>
                            权重: 验收 ({item.acceptanceRatio * 100}%) / 报告 ({item.reportRatio * 100}%) / 代码 ({item.codeRatio * 100}%)
                          </span>
                          <span>|</span>
                          <span className="text-zinc-300 font-semibold">总评占比: {item.courseWeight} 分</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center min-w-[110px]">
                          <span className="text-xs text-zinc-400 block font-medium">总评得分</span>
                          <span className="text-xl font-bold font-mono text-zinc-400">
                            0 <span className="text-xs font-normal">/ {item.courseWeight}分</span>
                          </span>
                          <div className="text-[10px] text-zinc-500 mt-0.5">未发布 (暂不可操作)</div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // 3. PUBLISHED EXPERIMENT ITEM
                const sub = item.submission;
                const isGraded = item.status === "GRADED";

                return (
                  <div
                    key={`exp-pub-${item.experimentId}`}
                    className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition flex flex-col md:flex-row justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-sky-500/20 text-sky-300 font-mono">
                          {item.experimentNumber}
                        </span>
                        <h3 className="text-lg font-semibold text-zinc-100">{item.experimentName}</h3>
                        <span className="text-xs text-zinc-400 px-2 py-0.5 rounded bg-white/5">
                          {item.type === "HARDWARE" ? "硬件实验" : item.type === "SOFTWARE" ? "软件实验" : "综合实验"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          已发布
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 space-x-3 flex flex-wrap gap-y-1">
                        <span>截止时间: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "-"}</span>
                        <span>|</span>
                        <span>
                          权重: 验收 ({item.acceptanceRatio * 100}%) / 报告 ({item.reportRatio * 100}%) / 代码 ({item.codeRatio * 100}%)
                        </span>
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
  // TEACHER DASHBOARD VIEW (DEDICATED)
  // -------------------------------------------------------------
  if (session.role === "TEACHER") {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Teacher Header */}
        <div className="glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-emerald-500">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                教师工作台 (Teacher Portal)
              </span>
              <span className="text-xs text-zinc-400">计算机系统Ⅱ (CS2052M)</span>
            </div>
            <h1 className="text-3xl font-bold mt-2 text-zinc-100">
              欢迎，{session.name || "老师"} 老师
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              当前为教师教学视察与小测管理系统。教师具备实验/作业查看与随堂小测发布权限（实验批改由助教团队执行）。
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

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-xs text-zinc-400 block mb-1">选课学生总数</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-zinc-100">70</span>
              <span className="text-xs text-zinc-400">人 (已在籍)</span>
            </div>
            <span className="text-[11px] text-emerald-400 mt-2 block">全员档案就绪</span>
          </div>

          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-xs text-zinc-400 block mb-1">随堂小测</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-purple-400">随时发布</span>
            </div>
            <span className="text-[11px] text-zinc-400 mt-2 block">支持姓名缩写连续快捷录入</span>
          </div>

          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-xs text-zinc-400 block mb-1">实验项目规划</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-sky-400">只读视察</span>
            </div>
            <span className="text-[11px] text-zinc-400 mt-2 block">批改由助教团队统筹</span>
          </div>

          <div className="glass p-5 rounded-2xl border border-white/10">
            <span className="text-xs text-zinc-400 block mb-1">开发板设备</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-teal-400">动态监控</span>
            </div>
            <span className="text-[11px] text-zinc-400 mt-2 block">借还与共用人实时追踪</span>
          </div>
        </div>

        {/* Teacher Action Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quizzes Entry */}
          <a
            href="/quizzes"
            className="glass p-6 rounded-2xl hover:border-purple-500/50 hover:bg-purple-500/5 transition group relative overflow-hidden"
          >
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-300 w-fit mb-4 group-hover:scale-110 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-zinc-100">随堂小测发布与快速记分</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                教师特权
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              发布随堂小测，设定占总评分数与是否立即向学生公布成绩。支持按学号、姓名或拼音首字母缩写连续键盘录入分数。
            </p>
            <div className="mt-4 text-sm font-semibold text-purple-300 flex items-center gap-1 group-hover:translate-x-1 transition">
              进入小测管理系统 →
            </div>
          </a>

          {/* View Experiments (Read Only) */}
          <a
            href="/experiments"
            className="glass p-6 rounded-2xl hover:border-sky-500/50 hover:bg-sky-500/5 transition group"
          >
            <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 w-fit mb-4 group-hover:scale-110 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-zinc-100">查看实验规划与项目</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                查看模式
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              查阅已发布的实验进度、评分权重分配、截止时间及思考题。（教师端无批改权限，批改由助教执行）。
            </p>
            <div className="mt-4 text-sm font-semibold text-sky-300 flex items-center gap-1 group-hover:translate-x-1 transition">
              浏览实验项目列表 →
            </div>
          </a>

          {/* View Assignments (Read Only) */}
          <a
            href="/assignments"
            className="glass p-6 rounded-2xl hover:border-amber-500/50 hover:bg-amber-500/5 transition group"
          >
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 w-fit mb-4 group-hover:scale-110 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-zinc-100">查看学生作业与成绩名册</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                成绩总览
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              视察全体 70 位学生的实验报告、源代码批改评分、现场验收分数及查重告警记录（只读模式）。
            </p>
            <div className="mt-4 text-sm font-semibold text-amber-300 flex items-center gap-1 group-hover:translate-x-1 transition">
              查看学生作业名册 →
            </div>
          </a>

          {/* Boards */}
          <a
            href="/boards"
            className="glass p-6 rounded-2xl hover:border-teal-500/50 hover:bg-teal-500/5 transition group"
          >
            <div className="p-3 rounded-xl bg-teal-500/20 text-teal-400 w-fit mb-4 group-hover:scale-110 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-zinc-100">查看开发板与借用记录</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">
                硬件物资
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              实时查看实验室开发板借用人、组内共用成员、联系电话与借还状态。
            </p>
            <div className="mt-4 text-sm font-semibold text-teal-300 flex items-center gap-1 group-hover:translate-x-1 transition">
              查看开发板列表 →
            </div>
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // TA DASHBOARD VIEW (TA ONLY)
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

      {/* Quick Links for TA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        <a href="/quizzes" className="glass p-6 rounded-2xl hover:border-purple-500/50 hover:bg-white/10 transition group">
          <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 w-fit mb-4 group-hover:scale-110 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">随堂小测管理</h2>
          <p className="text-sm text-zinc-400 mt-2">发布随堂小测，支持按姓名缩写连续录入小测分数。</p>
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
