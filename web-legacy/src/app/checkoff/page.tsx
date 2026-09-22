"use client";

import { useEffect, useState, useRef } from "react";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

export default function CheckoffPage() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string>("");
  const [currentExp, setCurrentExp] = useState<any>(null);

  // Search & Locate
  const [searchQuery, setSearchQuery] = useState("");
  const [matchedStudents, setMatchedStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Question draw
  const [drawCount, setDrawCount] = useState<number>(2);
  const [drawnQuestions, setDrawnQuestions] = useState<any[]>([]);

  // Scores (0-100 scale entered by TA)
  const [rawAcceptanceScore, setRawAcceptanceScore] = useState<string>("");
  const [rawCodeScore, setRawCodeScore] = useState<string>("");
  const [checkpointClaimed, setCheckpointClaimed] = useState<boolean>(false);
  const [remark, setRemark] = useState<string>("");

  // Previous student
  const [lastStudent, setLastStudent] = useState<any>(null);

  // Save states & Animation
  const [saving, setSaving] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [message, setMessage] = useState("");

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const acceptanceInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-locate student by query or barcode and enter grading view
  const autoLocateAndSelectStudent = async (query: string) => {
    const q = query.trim();
    if (!q || !selectedExpId) return;

    setMessage("");
    try {
      const res = await fetch(`/api/checkoff?experimentId=${selectedExpId}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && data.matchedStudents?.length > 0) {
        setMatchedStudents(data.matchedStudents);
        if (data.matchedStudents.length === 1) {
          // Exactly 1 student matched: immediately open checkoff workspace!
          handleSelectStudent(data.matchedStudents[0]);
          setShowCamera(false);
        } else {
          // Multiple students sharing board: close camera and show selection
          setShowCamera(false);
        }
      } else {
        setMessage(`⚠️ 未找到与输入/条形码 [${q}] 匹配的学生或开发板`);
      }
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ 搜索失败: ${err.message}`);
    }
  };

  // Load experiments on mount
  useEffect(() => {
    fetch('/api/checkoff')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.experiments) {
          setExperiments(data.experiments);
          const active = data.currentExperiment || data.experiments[0];
          setSelectedExpId(active.id);
          setCurrentExp(active);
        }
      })
      .catch(err => console.error(err));

    // Restore last student from sessionStorage if available
    try {
      const saved = sessionStorage.getItem('lastCheckedStudent');
      if (saved) {
        setLastStudent(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Handle experiment switch
  const handleExpChange = (expId: string) => {
    setSelectedExpId(expId);
    const exp = experiments.find(e => e.id === expId);
    setCurrentExp(exp || null);
    setSelectedStudent(null);
    setDrawnQuestions([]);
    setMatchedStudents([]);
    setSearchQuery("");
  };

  // Search query trigger (debounced for manual typing)
  useEffect(() => {
    if (!searchQuery.trim() || !selectedExpId) {
      setMatchedStudents([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/checkoff?experimentId=${selectedExpId}&q=${encodeURIComponent(searchQuery.trim())}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setMatchedStudents(data.matchedStudents || []);
            if (data.matchedStudents?.length === 1 && searchQuery.length >= 6) {
              handleSelectStudent(data.matchedStudents[0]);
            }
          }
        })
        .catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedExpId]);

  // Select student for checkoff
  const handleSelectStudent = (st: any) => {
    setSelectedStudent(st);
    setMessage("");
    setCheckpointClaimed(st.hasCheckpoint || st.submission?.checkpointClaimed || false);
    setRemark(st.submission?.remark || (st.hasCheckpoint ? "申领了Checkpoint" : ""));

    // Pre-populate raw score if already submitted
    if (st.submission?.acceptanceScore !== null && st.submission?.acceptanceScore !== undefined) {
      setRawAcceptanceScore(st.submission.acceptanceScore.toString());
    } else {
      setRawAcceptanceScore("");
    }

    if (st.submission?.codeScore !== null && st.submission?.codeScore !== undefined) {
      setRawCodeScore(st.submission.codeScore.toString());
    } else {
      setRawCodeScore("");
    }

    // Auto-draw questions
    drawRandomQuestions(drawCount);

    // Auto-focus acceptance score input
    setTimeout(() => {
      if (acceptanceInputRef.current) {
        acceptanceInputRef.current.focus();
        acceptanceInputRef.current.select();
      }
    }, 200);
  };

  // Draw random questions from current experiment's bank
  const drawRandomQuestions = (count: number) => {
    if (!currentExp?.questions || currentExp.questions.length === 0) {
      setDrawnQuestions([]);
      return;
    }
    const pool = [...currentExp.questions];
    const shuffled = pool.sort(() => 0.5 - Math.random());
    setDrawnQuestions(shuffled.slice(0, Math.min(count, pool.length)));
  };

  // Save checkoff score
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !currentExp) return;

    setSaving(true);
    setMessage("");

    try {
      const resp = await fetch('/api/checkoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentId: currentExp.id,
          studentId: selectedStudent.id,
          rawAcceptanceScore: checkpointClaimed ? 0 : rawAcceptanceScore,
          rawCodeScore: checkpointClaimed ? 0 : rawCodeScore,
          checkpointClaimed,
          remark
        })
      });

      const data = await resp.json();
      if (resp.ok) {
        // Record last student
        const prev = {
          ...selectedStudent,
          experimentId: currentExp.id,
          savedAt: new Date().toLocaleTimeString()
        };
        setLastStudent(prev);
        try {
          sessionStorage.setItem('lastCheckedStudent', JSON.stringify(prev));
        } catch {}

        // Trigger short success animation
        setShowSuccessAnim(true);
        setTimeout(() => {
          setShowSuccessAnim(false);
          // Reset view to search for next student
          setSelectedStudent(null);
          setSearchQuery("");
          setMatchedStudents([]);
          setDrawnQuestions([]);
          setRawAcceptanceScore("");
          setRawCodeScore("");
          setCheckpointClaimed(false);
          setRemark("");
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 800);
      } else {
        setMessage("❌ 保存失败: " + (data.error || "未知错误"));
      }
    } catch (err: any) {
      setMessage("❌ 网络错误: " + err.message);
    }
    setSaving(false);
  };

  // Barcode detected from camera
  const handleCameraBarcode = (barcode: string) => {
    setSearchQuery(barcode);
    autoLocateAndSelectStudent(barcode);
  };

  // Derived score conversions
  const parsedRawAcceptance = parseFloat(rawAcceptanceScore) || 0;
  const parsedRawCode = parseFloat(rawCodeScore) || 0;
  const convertedAcceptance = checkpointClaimed ? 0 : Math.round((parsedRawAcceptance / 100) * (currentExp?.totalScore || 100) * (currentExp?.acceptanceRatio || 0.5) * 10) / 10;
  const convertedCode = checkpointClaimed ? 0 : Math.round((parsedRawCode / 100) * (currentExp?.totalScore || 100) * (currentExp?.codeRatio || 0.3) * 10) / 10;
  const estimatedLabScore = checkpointClaimed ? 0 : (convertedAcceptance + convertedCode);
  const estimatedCourseContribution = checkpointClaimed ? 0 : Math.round((estimatedLabScore / 100) * (currentExp?.courseWeight || 0) * 100) / 100;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Success Animation Modal / Overlay */}
      {showSuccessAnim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="glass p-8 rounded-3xl flex flex-col items-center gap-4 scale-110 shadow-2xl animate-bounce">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 text-4xl shadow-[0_0_30px_rgba(52,211,153,0.5)]">
              ✓
            </div>
            <h3 className="text-xl font-bold text-emerald-300">评分保存成功</h3>
            <p className="text-xs text-zinc-400">正在返回就绪下一位同学...</p>
          </div>
        </div>
      )}

      {/* Header & Experiment Selection */}
      <div className="glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              助教端
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              实验现场验收
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">
            实验验收控制台 (Checkoff)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            支持扫码枪/摄像头扫码、学号尾号或姓名拼音定位。助教输入百分制分数，系统自动折算实验分与课程总评分。
          </p>
        </div>

        {/* Experiment Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-xs text-zinc-400">切换实验:</label>
          <select
            value={selectedExpId}
            onChange={(e) => handleExpChange(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/20 text-sm text-zinc-200 focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            {experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>
                [{exp.number}] {exp.name} {exp.isPublished ? "（进行中）" : "（草稿）"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Experiment Info Strip */}
      {currentExp && (
        <div className="glass p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sky-400 text-sm">
              {currentExp.number}: {currentExp.name}
            </span>
            <span className={`px-2 py-0.5 rounded font-medium ${
              currentExp.type === 'HARDWARE' ? 'bg-amber-500/20 text-amber-300' :
              currentExp.type === 'SOFTWARE' ? 'bg-purple-500/20 text-purple-300' :
              'bg-teal-500/20 text-teal-300'
            }`}>
              {currentExp.type === 'HARDWARE' ? '硬件实验' : currentExp.type === 'SOFTWARE' ? '软件实验' : '软硬件贯通综合'}
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
              总评权重: {currentExp.courseWeight} 分 (全课30分)
            </span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <span>
              分数构成: <strong className="text-emerald-400">验收 50%</strong> (满分50) / <strong className="text-zinc-200">报告 20%</strong> (满分20) / <strong className="text-sky-400">代码 30%</strong> (满分30)
            </span>
            <span>|</span>
            <span>截止验收: {new Date(currentExp.dueDate).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Suggested Search Banner (build.md specification) */}
      {currentExp && (
        <div className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-4 ${
          currentExp.type !== 'SOFTWARE'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <span>
              {currentExp.type !== 'SOFTWARE' ? (
                <>
                  <strong>建议：</strong>当前为硬件/综合实验，推荐通过<strong>扫描开发板条形码</strong>或输入开发板 <strong>DB 号 / 资产编号</strong>快速定位学生。<span className="opacity-80 text-xs ml-1">（该项功能仅作建议，不强制要求，亦可输入学号尾号或姓名拼音缩写）</span>
                </>
              ) : (
                <>
                  <strong>提示：</strong>当前为软件实验，请输入<strong>学号尾号</strong>（如 4783）或<strong>姓名拼音首字母缩写</strong>（如 wrc）快速定位学生。
                </>
              )}
            </span>
          </div>

          {/* View Previous Student Button */}
          {lastStudent && (
            <button
              onClick={() => handleSelectStudent(lastStudent)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-800 dark:text-white transition whitespace-nowrap flex items-center gap-1.5 border border-white/20 shadow-sm"
            >
              <span>⏪ 查看上一个人</span>
              <span className="font-bold text-sky-500 dark:text-sky-300">({lastStudent.name})</span>
            </button>
          )}
        </div>
      )}

      {/* Camera Barcode Scanner Modal (Safari Optimized) */}
      {showCamera && (
        <div className="glass p-4 rounded-2xl border border-emerald-500/30 space-y-3">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              系统摄像头条形码扫描 (Safari / 手机 / 电脑)
            </h3>
            <button
              onClick={() => setShowCamera(false)}
              className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
            >
              关闭
            </button>
          </div>
          <CameraBarcodeScanner
            onDetected={handleCameraBarcode}
            onClose={() => setShowCamera(false)}
          />
        </div>
      )}

      {/* Search Input Bar */}
      <div className="glass p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  autoLocateAndSelectStudent(searchQuery);
                }
              }}
              placeholder="输入学号尾号 / 姓名拼音缩写 (如 wrc) / 开发板 DB 号 (如 DBCFBC2) / 资产号..."
              className="w-full px-5 py-3.5 pl-12 rounded-xl bg-white/5 border border-white/15 focus:border-blue-400 focus:bg-white/10 transition text-base text-zinc-100 placeholder-zinc-500 focus:outline-none"
              autoFocus
            />
            <span className="absolute left-4 top-4 text-zinc-400 text-lg">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-3.5 px-2 py-0.5 rounded-md text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition"
              >
                清空
              </button>
            )}
          </div>

          <button
            onClick={() => setShowCamera(!showCamera)}
            className="px-5 py-3.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 transition font-medium flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
          >
            <span>📷</span>
            <span>{showCamera ? "收起摄像头" : "打开摄像头扫码"}</span>
          </button>
        </div>

        {/* Matched Students List / Shared Board Selector */}
        {matchedStudents.length > 0 && !selectedStudent && (
          <div className="space-y-3 pt-2">
            {matchedStudents.length > 1 && (
              <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>检测到开发板由多名同学共用（或存在多条匹配结果），请选择当前正在验收的同学：</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {matchedStudents.map((st) => (
                <div
                  key={st.id}
                  onClick={() => handleSelectStudent(st)}
                  className="p-4 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-blue-400/50 cursor-pointer transition flex flex-col justify-between gap-3 group shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-zinc-100 group-hover:text-blue-300 transition">
                          {st.name}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          ({st.pinyin})
                        </span>
                        {st.hasCheckpoint && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Checkpoint
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono mt-0.5">
                        学号: {st.studentId}
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 group-hover:bg-blue-500 group-hover:text-white transition">
                      开始验收 →
                    </span>
                  </div>

                  {st.board && (
                    <div className="p-2 rounded-lg bg-black/30 text-[11px] text-zinc-300 flex justify-between items-center font-mono">
                      <span>DB: {st.board.dbNo}</span>
                      <span>资产号: {st.board.assetNo}</span>
                      {st.board.isShared && (
                        <span className="text-amber-400 text-[10px]">
                          (共用: {st.board.teamMembers.join(",")})
                        </span>
                      )}
                    </div>
                  )}

                  {st.submission?.acceptanceScore !== null && st.submission?.acceptanceScore !== undefined && (
                    <div className="text-xs text-emerald-400 flex items-center gap-1">
                      <span>✓ 已验收: {st.submission.acceptanceScore} 分</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected Student Checkoff Workspace */}
      {selectedStudent && currentExp && (
        <form onSubmit={handleSave} className="glass p-6 md:p-8 rounded-2xl space-y-6 border border-blue-500/30 shadow-xl">
          {/* Top Bar for Selected Student */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-white/10 gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center font-bold text-xl text-white shadow-md">
                {selectedStudent.name.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-zinc-100">{selectedStudent.name}</h2>
                  <span className="text-sm font-mono text-zinc-400">({selectedStudent.studentId})</span>
                  {selectedStudent.hasCheckpoint && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      已申领 Checkpoint
                    </span>
                  )}
                </div>
                {selectedStudent.board && (
                  <div className="text-xs text-zinc-400 flex items-center gap-3 mt-1">
                    <span>开发板 DB: <strong className="text-teal-300 font-mono">{selectedStudent.board.dbNo}</strong></span>
                    <span>资产号: <strong className="text-sky-300 font-mono">{selectedStudent.board.assetNo}</strong></span>
                    {selectedStudent.board.teamMembers?.length > 0 && (
                      <span>队友: <strong className="text-zinc-200">{selectedStudent.board.teamMembers.join(", ")}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedStudent(null)}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300 border border-white/10 transition"
            >
              ✕ 更换同学
            </button>
          </div>

          {/* Random Question Draw Section */}
          <div className="glass p-5 rounded-xl space-y-3 bg-white/5 border border-white/10">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-zinc-200">
                <span>🎲</span>
                <span>现场问答抽题</span>
                <span className="text-xs text-zinc-400 font-normal">
                  (当前题库共有 {currentExp.questions?.length || 0} 道题)
                </span>
              </h3>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">抽取数量:</span>
                <select
                  value={drawCount}
                  onChange={(e) => {
                    const c = parseInt(e.target.value);
                    setDrawCount(c);
                    drawRandomQuestions(c);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/15 text-xs text-zinc-200"
                >
                  <option value={1}>1 道题</option>
                  <option value={2}>2 道题</option>
                  <option value={3}>3 道题</option>
                  <option value={4}>4 道题</option>
                </select>

                <button
                  type="button"
                  onClick={() => drawRandomQuestions(drawCount)}
                  className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-medium border border-blue-500/30 transition flex items-center gap-1"
                >
                  <span>🔄</span>
                  <span>重新随机抽取</span>
                </button>
              </div>
            </div>

            {drawnQuestions.length > 0 ? (
              <div className="space-y-2 pt-1">
                {drawnQuestions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-zinc-200 flex gap-3"
                  >
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-500/20 text-sky-400 h-fit">
                      Q{idx + 1}
                    </span>
                    <p className="flex-1 leading-relaxed text-zinc-200">
                      {q.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-2">暂无抽取的题目，点击右上角按钮进行抽取。</p>
            )}
          </div>

          {/* Scoring Section (0-100 entered by TA, auto-converted) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Acceptance Score Input */}
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <span>🎯 验收评分 (0 - 100 分)</span>
                </label>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  满分 50 分 (占50%)
                </span>
              </div>

              <div className="relative">
                <input
                  ref={acceptanceInputRef}
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  disabled={checkpointClaimed}
                  value={rawAcceptanceScore}
                  onChange={(e) => setRawAcceptanceScore(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave(e);
                    }
                  }}
                  placeholder="输入 0 - 100 分制打分"
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-emerald-500/30 focus:border-emerald-400 text-lg font-mono font-bold text-emerald-300 focus:outline-none"
                />
              </div>

              <div className="text-xs text-zinc-400 flex justify-between items-center pt-1">
                <span>助教输入百分制，系统自动换算：</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  折算实验分: {convertedAcceptance} / 50 分
                </span>
              </div>
            </div>

            {/* Code Score Input */}
            <div className="p-5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-sky-300 flex items-center gap-2">
                  <span>💻 代码评分 (0 - 100 分，可选)</span>
                </label>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  满分 30 分 (占30%)
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  disabled={checkpointClaimed}
                  value={rawCodeScore}
                  onChange={(e) => setRawCodeScore(e.target.value)}
                  placeholder="如现场需调整代码评分则输入"
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-sky-500/30 focus:border-sky-400 text-lg font-mono font-bold text-sky-300 focus:outline-none"
                />
              </div>

              <div className="text-xs text-zinc-400 flex justify-between items-center pt-1">
                <span>现场调整代码分自动换算：</span>
                <span className="font-mono text-sky-400 font-bold text-sm">
                  折算实验分: {convertedCode} / 30 分
                </span>
              </div>
            </div>
          </div>

          {/* Checkpoint & Remark Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <input
                type="checkbox"
                id="checkpointCheck"
                checked={checkpointClaimed}
                onChange={(e) => {
                  setCheckpointClaimed(e.target.checked);
                  if (e.target.checked) {
                    setRemark("申领了Checkpoint（免做本次实验）");
                  }
                }}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
              />
              <label htmlFor="checkpointCheck" className="text-xs font-semibold text-amber-200 cursor-pointer">
                申领了 Checkpoint（免做本次实验，实验记 0 分，并在学生端显示说明）
              </label>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">
                验收评语 / 答辩表现记录（选填）
              </label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="例如：指令通路讲解清晰，问答全部回答正确..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Final Score Estimate Strip */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/15 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-zinc-400 block">本次预计实验得分</span>
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {estimatedLabScore} <span className="text-sm font-normal text-zinc-400">/ 100</span>
                </span>
              </div>
              <div className="border-l border-white/15 pl-6">
                <span className="text-xs text-zinc-400 block">折算课程总评分数 (占{currentExp.courseWeight}分)</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {estimatedCourseContribution} <span className="text-sm font-normal text-zinc-400">/ {currentExp.courseWeight} 分</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {message && <span className="text-xs text-rose-400 mr-2">{message}</span>}
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 font-bold text-white shadow-lg shadow-teal-500/20 transition transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <span>💾</span>
                <span>{saving ? "正在保存..." : "保存评分并继续下一位"}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
