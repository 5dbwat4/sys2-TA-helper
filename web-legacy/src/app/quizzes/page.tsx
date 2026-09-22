"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import ThemeToggle from "@/components/ThemeToggle";

interface QuizItem {
  id: string;
  name: string;
  courseWeight: number;
  totalScore: number;
  publishDate: string;
  isPublished: boolean;
  createdAt: string;
  totalStudents: number;
  gradedCount: number;
  avgScore: number;
}

interface StudentScoreItem {
  id: string;
  studentId: string;
  name: string;
  pinyinInitial: string;
  score: number | null;
  remark: string;
  updatedAt: string | null;
}

export default function QuizzesPage() {
  const [role, setRole] = useState<string>("STUDENT");
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [roster, setRoster] = useState<StudentScoreItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);

  // New Quiz Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuizName, setNewQuizName] = useState("");
  const [newQuizWeight, setNewQuizWeight] = useState("2.0");
  const [newQuizTotalScore, setNewQuizTotalScore] = useState("100");
  const [newQuizPublishDate, setNewQuizPublishDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newQuizIsPublished, setNewQuizIsPublished] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Continuous Entry States
  const [queryText, setQueryText] = useState("");
  const [matchedStudent, setMatchedStudent] = useState<StudentScoreItem | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [remarkInput, setRemarkInput] = useState("");
  const [entryStatus, setEntryStatus] = useState<{ msg: string; isError?: boolean } | null>(null);
  const [savingContinuous, setSavingContinuous] = useState(false);

  // Table Search & Filter
  const [tableSearch, setTableSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "GRADED" | "UNGRADED">("ALL");

  // DOM Refs for seamless keyboard workflow
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);

  // Load Session & Quizzes
  useEffect(() => {
    fetch("/api/auth/session")
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setRole(data.user.role);
        }
      })
      .catch(() => {});

    loadQuizzes();
  }, []);

  const loadQuizzes = async (selectId?: string) => {
    setLoading(true);
    try {
      const resp = await fetch("/api/quizzes");
      const data = await resp.json();
      if (data.success && data.quizzes) {
        setQuizzes(data.quizzes);
        if (data.quizzes.length > 0) {
          const targetId = selectId || selectedQuizId || data.quizzes[0].id;
          setSelectedQuizId(targetId);
          loadQuizScores(targetId);
        }
      }
    } catch (err) {
      console.error("Failed to load quizzes", err);
    }
    setLoading(false);
  };

  const loadQuizScores = async (quizId: string) => {
    if (!quizId) return;
    setRosterLoading(true);
    try {
      const resp = await fetch(`/api/quizzes/${quizId}/scores`);
      const data = await resp.json();
      if (data.success) {
        setRoster(data.roster);
      }
    } catch (err) {
      console.error("Failed to load scores", err);
    }
    setRosterLoading(false);
  };

  const handleSelectQuiz = (id: string) => {
    setSelectedQuizId(id);
    setMatchedStudent(null);
    setScoreInput("");
    setRemarkInput("");
    setQueryText("");
    setEntryStatus(null);
    loadQuizScores(id);
  };

  const currentQuiz = useMemo(() => {
    return quizzes.find(q => q.id === selectedQuizId) || null;
  }, [quizzes, selectedQuizId]);

  // Create Quiz Submit
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");

    try {
      const resp = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newQuizName,
          courseWeight: newQuizWeight,
          totalScore: newQuizTotalScore,
          publishDate: newQuizPublishDate,
          isPublished: newQuizIsPublished,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setShowCreateModal(false);
        setNewQuizName("");
        setNewQuizWeight("2.0");
        loadQuizzes(data.quiz.id);
      } else {
        setCreateError(data.error || "创建失败");
      }
    } catch (err: any) {
      setCreateError(err.message);
    }
    setCreating(false);
  };

  // Toggle Publish Status
  const handleTogglePublish = async (quiz: QuizItem) => {
    try {
      const resp = await fetch("/api/quizzes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quiz.id,
          isPublished: !quiz.isPublished,
        }),
      });
      if (resp.ok) {
        loadQuizzes(quiz.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = async (quiz: QuizItem) => {
    if (!confirm(`确定要删除小测「${quiz.name}」吗？已录入的所有成绩将被一并清除。`)) return;
    try {
      const resp = await fetch(`/api/quizzes?id=${quiz.id}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        loadQuizzes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fast Autocomplete Candidate Search
  const candidateMatches = useMemo(() => {
    if (!queryText.trim()) return [];
    const q = queryText.trim().toLowerCase();
    return roster.filter(st => {
      const idMatch = st.studentId.includes(q);
      const nameMatch = st.name.toLowerCase().includes(q);
      const pinyinMatch = st.pinyinInitial.toLowerCase().startsWith(q) || st.pinyinInitial.toLowerCase().includes(q);
      return idMatch || nameMatch || pinyinMatch;
    }).slice(0, 6);
  }, [queryText, roster]);

  // Handle Query Input Keydown (Tab / Enter to select candidate)
  const handleQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "Enter") && candidateMatches.length > 0) {
      e.preventDefault();
      selectCandidate(candidateMatches[0]);
    }
  };

  const selectCandidate = (st: StudentScoreItem) => {
    setMatchedStudent(st);
    setQueryText(`${st.name} (${st.studentId})`);
    setScoreInput(st.score !== null && st.score !== undefined ? st.score.toString() : "");
    setRemarkInput(st.remark || "");
    setEntryStatus(null);
    setTimeout(() => {
      scoreInputRef.current?.focus();
      scoreInputRef.current?.select();
    }, 50);
  };

  // Save Continuous Score Entry
  const handleContinuousSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;

    // If no candidate was explicitly selected from dropdown, try matching first candidate
    let target = matchedStudent;
    if (!target && candidateMatches.length > 0) {
      target = candidateMatches[0];
    }

    if (!target) {
      setEntryStatus({ msg: "请先选择或匹配到有效学生", isError: true });
      searchInputRef.current?.focus();
      return;
    }

    const parsedScore = scoreInput.trim() === "" ? null : parseFloat(scoreInput);
    if (parsedScore !== null && (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 1000)) {
      setEntryStatus({ msg: "请输入有效的成绩分值", isError: true });
      return;
    }

    setSavingContinuous(true);
    try {
      const resp = await fetch(`/api/quizzes/${selectedQuizId}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: target.studentId,
          score: parsedScore,
          remark: remarkInput.trim() || null,
        }),
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        // Update roster locally
        setRoster(prev =>
          prev.map(st =>
            st.studentId === target!.studentId
              ? { ...st, score: parsedScore, remark: remarkInput.trim() || "", updatedAt: new Date().toISOString() }
              : st
          )
        );

        setEntryStatus({
          msg: `✅ 已成功登记「${target.name}」小测成绩: ${parsedScore !== null ? parsedScore + " 分" : "已清除"}`,
          isError: false,
        });

        // Reset continuous fields and focus back to search input
        setMatchedStudent(null);
        setQueryText("");
        setScoreInput("");
        setRemarkInput("");
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);

        // Background update quiz statistics
        loadQuizzes(selectedQuizId);
      } else {
        setEntryStatus({ msg: "❌ 保存失败: " + (data.error || "未知错误"), isError: true });
      }
    } catch (err: any) {
      setEntryStatus({ msg: "❌ 网络错误: " + err.message, isError: true });
    }
    setSavingContinuous(false);
  };

  // Filtered Roster for Table
  const filteredRoster = useMemo(() => {
    return roster.filter(st => {
      const q = tableSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        st.studentId.includes(q) ||
        st.name.toLowerCase().includes(q) ||
        st.pinyinInitial.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterMode === "GRADED") return st.score !== null;
      if (filterMode === "UNGRADED") return st.score === null;
      return true;
    });
  }, [roster, tableSearch, filterMode]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="glass p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">随堂小测管理与成绩录入</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {role === "TEACHER" ? "教师专区" : "助教专区"}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            发布随堂小测，支持按学号、姓名或拼音缩写（如 <code className="text-purple-300">zs</code>）连续键盘快速记分。
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setCreateError("");
          }}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-lg font-semibold transition flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          发布新小测 (New Quiz)
        </button>
      </div>

      {/* Quizzes List Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">全部随堂小测</h2>
          <span className="text-xs text-zinc-400">共 {quizzes.length} 个小测</span>
        </div>

        {quizzes.length === 0 ? (
          <div className="glass p-8 text-center text-zinc-400 rounded-2xl">
            暂无随堂小测记录，请点击右上角「发布新小测」创建。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map(q => {
              const isSelected = q.id === selectedQuizId;
              return (
                <div
                  key={q.id}
                  onClick={() => handleSelectQuiz(q.id)}
                  className={`p-5 rounded-2xl cursor-pointer transition relative border ${
                    isSelected
                      ? "glass border-purple-500 shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/30"
                      : "glass border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-zinc-100 truncate flex-1">
                      {q.name}
                    </h3>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                        q.isPublished
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
                      }`}
                    >
                      {q.isPublished ? "已公布给学生" : "未公布 (草稿)"}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-1 mb-4">
                    <div className="flex justify-between">
                      <span>占总评分数:</span>
                      <span className="font-semibold text-purple-300 font-mono">{q.courseWeight} 分</span>
                    </div>
                    <div className="flex justify-between">
                      <span>进行/发布日期:</span>
                      <span className="font-mono text-zinc-300">
                        {new Date(q.publishDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>已录入进度:</span>
                      <span className="font-mono text-zinc-300">
                        {q.gradedCount} / {q.totalStudents} 人
                      </span>
                    </div>
                    {q.gradedCount > 0 && (
                      <div className="flex justify-between">
                        <span>平均分:</span>
                        <span className="font-mono text-emerald-400 font-semibold">{q.avgScore} 分</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleTogglePublish(q);
                      }}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        q.isPublished
                          ? "bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {q.isPublished ? "撤回公布" : "立即公布"}
                    </button>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteQuiz(q);
                      }}
                      className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grade Entry & Roster Area */}
      {currentQuiz && (
        <div className="space-y-6">
          {/* Continuous Fast Entry Bar */}
          <div className="glass p-6 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-400 animate-pulse"></span>
                  连续快速成绩录入: <span className="text-purple-300">{currentQuiz.name}</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  输入学号、姓名或姓名拼音缩写（如输入 <code className="text-purple-300">zs</code> 联想张三），按 Tab 或 Enter 填写分数后直接回车保存，焦点自动循环。
                </p>
              </div>
              <div className="text-xs text-zinc-400 font-mono">
                总评分占比: <span className="font-bold text-purple-300">{currentQuiz.courseWeight}分</span> | 满分: {currentQuiz.totalScore}分
              </div>
            </div>

            {/* Continuous Form */}
            <form onSubmit={handleContinuousSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 relative">
                {/* 1. Student Search Input (6 cols) */}
                <div className="sm:col-span-5 relative">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    1. 学生学号 / 姓名 / 拼音缩写
                  </label>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={queryText}
                    onChange={e => {
                      setQueryText(e.target.value);
                      setMatchedStudent(null);
                    }}
                    onKeyDown={handleQueryKeyDown}
                    placeholder="输入如: 325010 / 张三 / zs"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium"
                    autoFocus
                  />

                  {/* Autocomplete Dropdown */}
                  {!matchedStudent && candidateMatches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 glass border border-purple-500/40 rounded-xl overflow-hidden shadow-2xl divide-y divide-white/5 max-h-56 overflow-y-auto">
                      {candidateMatches.map((st, idx) => (
                        <div
                          key={st.id}
                          onClick={() => selectCandidate(st)}
                          className={`px-4 py-2.5 text-xs flex justify-between items-center cursor-pointer transition ${
                            idx === 0 ? "bg-purple-500/20 text-purple-200" : "hover:bg-white/5 text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-100">{st.name}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">({st.studentId})</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 font-mono">
                              {st.pinyinInitial}
                            </span>
                          </div>
                          <span className="text-zinc-400 font-mono">
                            {st.score !== null ? `当前: ${st.score}分` : "待录入"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Score Input (3 cols) */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    2. 小测得分 (0-100)
                  </label>
                  <input
                    ref={scoreInputRef}
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={scoreInput}
                    onChange={e => setScoreInput(e.target.value)}
                    placeholder="分数，如: 95"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono font-bold text-purple-300"
                  />
                </div>

                {/* 3. Remark Input (2 cols) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    3. 备注 (可选)
                  </label>
                  <input
                    type="text"
                    value={remarkInput}
                    onChange={e => setRemarkInput(e.target.value)}
                    placeholder="选填备注..."
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                  />
                </div>

                {/* 4. Action Button (2 cols) */}
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    disabled={savingContinuous}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-sm shadow transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {savingContinuous ? "保存中..." : "登记回车 ↵"}
                  </button>
                </div>
              </div>
            </form>

            {/* Status Feedback Banner */}
            {entryStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex justify-between items-center ${
                  entryStatus.isError
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                <span>{entryStatus.msg}</span>
                <button
                  onClick={() => setEntryStatus(null)}
                  className="hover:opacity-75 transition"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Roster Table */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 text-xs">
                <button
                  onClick={() => setFilterMode("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium ${
                    filterMode === "ALL" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  全部学生 ({roster.length})
                </button>
                <button
                  onClick={() => setFilterMode("GRADED")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium ${
                    filterMode === "GRADED" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  已登记 ({roster.filter(s => s.score !== null).length})
                </button>
                <button
                  onClick={() => setFilterMode("UNGRADED")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium ${
                    filterMode === "UNGRADED" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  待录入 ({roster.filter(s => s.score === null).length})
                </button>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="搜索学号、姓名、拼音缩写..."
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="glass rounded-2xl overflow-hidden border border-white/10">
              {rosterLoading ? (
                <div className="py-16 text-center text-zinc-400">正在加载成绩总表...</div>
              ) : filteredRoster.length === 0 ? (
                <div className="py-16 text-center text-zinc-400">未找到匹配的学生</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 border-b border-white/10 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-6 py-3.5">学号</th>
                        <th className="px-6 py-3.5">姓名</th>
                        <th className="px-6 py-3.5">缩写</th>
                        <th className="px-6 py-3.5">小测得分</th>
                        <th className="px-6 py-3.5">折算总评分</th>
                        <th className="px-6 py-3.5">备注</th>
                        <th className="px-6 py-3.5 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredRoster.map(st => {
                        const isGraded = st.score !== null;
                        const courseScore = isGraded
                          ? Math.round((st.score! / currentQuiz.totalScore) * currentQuiz.courseWeight * 100) / 100
                          : null;

                        return (
                          <tr key={st.id} className="hover:bg-white/5 transition">
                            <td className="px-6 py-4 font-mono font-medium text-zinc-200">
                              {st.studentId}
                            </td>
                            <td className="px-6 py-4 font-medium text-zinc-100">
                              {st.name}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-purple-300">
                              {st.pinyinInitial}
                            </td>
                            <td className="px-6 py-4 font-mono">
                              {isGraded ? (
                                <span className="font-bold text-purple-300 text-base">
                                  {st.score} <span className="text-xs font-normal text-zinc-400">/ {currentQuiz.totalScore}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-500">待录入</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-mono">
                              {isGraded ? (
                                <span className="font-bold text-emerald-400">
                                  {courseScore} <span className="text-xs font-normal text-zinc-400">/ {currentQuiz.courseWeight}分</span>
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-zinc-400 max-w-xs truncate">
                              {st.remark || "-"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => selectCandidate(st)}
                                className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-600 hover:text-white text-purple-300 border border-purple-500/30 text-xs font-semibold transition"
                              >
                                {isGraded ? "修改" : "录入"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Quiz Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 md:p-8 rounded-2xl max-w-lg w-full space-y-6 border border-white/20">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h2 className="text-xl font-bold text-zinc-100">发布随堂小测</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-500/20 text-red-300 text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  小测名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newQuizName}
                  onChange={e => setNewQuizName(e.target.value)}
                  placeholder="例如: 第一次随堂小测 (RISC-V 指令集)"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    小测占总评分数 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newQuizWeight}
                    onChange={e => setNewQuizWeight(e.target.value)}
                    placeholder="2.0"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-purple-500"
                    required
                  />
                  <span className="text-[11px] text-zinc-400 mt-1 block">计入期末总评的实际分值</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    小测卷面满分
                  </label>
                  <input
                    type="number"
                    value={newQuizTotalScore}
                    onChange={e => setNewQuizTotalScore(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-zinc-400 mt-1 block">通常为 100 分</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  进行 / 发布日期 <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={newQuizPublishDate}
                  onChange={e => setNewQuizPublishDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-purple-500 text-zinc-200"
                  required
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  用于在学生端时间线上与实验混合排序（同天优先显示小测）
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <label className="flex items-center gap-3 cursor-pointer text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={newQuizIsPublished}
                    onChange={e => setNewQuizIsPublished(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <div>
                    <span className="font-semibold block">立刻公布成绩给学生</span>
                    <span className="text-xs text-zinc-400 block mt-0.5">
                      勾选后学生即可在学生端查看该小测及自己的得分；若不勾选，将作为草稿仅教师/助教可见。
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow transition disabled:opacity-50"
                >
                  {creating ? "正在创建..." : "确认发布"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
