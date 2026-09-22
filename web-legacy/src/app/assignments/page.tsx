"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function AssignmentsContent() {
  const searchParams = useSearchParams();
  const initialExpId = searchParams.get("experimentId") || "";

  const [experiments, setExperiments] = useState<any[]>([]);
  const [selectedExpId, setSelectedExpId] = useState(initialExpId);
  const [currentExp, setCurrentExp] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "GRADED" | "PENDING" | "PLAGIARISED">("ALL");

  // Grading Modal State
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [acceptanceScore, setAcceptanceScore] = useState<string>("");
  const [reportScore, setReportScore] = useState<string>("");
  const [codeScore, setCodeScore] = useState<string>("");
  const [reportPenalty, setReportPenalty] = useState<number>(0);
  const [codePenalty, setCodePenalty] = useState<number>(0);
  const [isPlagiarised, setIsPlagiarised] = useState<boolean>(false);
  const [plagiarismGroup, setPlagiarismGroup] = useState<string>("");
  const [checkpointClaimed, setCheckpointClaimed] = useState<boolean>(false);
  const [remark, setRemark] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [topMessage, setTopMessage] = useState("");
  const [role, setRole] = useState<string>("TA");

  // Load Session & Role
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setRole(data.user.role);
        }
      })
      .catch(() => {});
  }, []);

  // Load Experiments List
  useEffect(() => {
    fetch('/api/experiments')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.experiments.length > 0) {
          setExperiments(data.experiments);
          if (!selectedExpId) {
            setSelectedExpId(data.experiments[0].id);
          }
        }
      });
  }, []);

  // Load Roster when selected experiment changes
  useEffect(() => {
    if (!selectedExpId) return;
    setLoading(true);
    fetch(`/api/experiments/${selectedExpId}/grade`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCurrentExp(data.experiment);
          setRoster(data.roster);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedExpId]);

  // Open grading modal for a student
  const handleOpenGradeModal = (st: any) => {
    setSelectedStudent(st);
    setModalMessage("");
    const sub = st.submission;
    if (sub) {
      setAcceptanceScore(sub.acceptanceScore !== null && sub.acceptanceScore !== undefined ? sub.acceptanceScore.toString() : "");
      setReportScore(sub.reportScore !== null && sub.reportScore !== undefined ? sub.reportScore.toString() : "");
      setCodeScore(sub.codeScore !== null && sub.codeScore !== undefined ? sub.codeScore.toString() : "");
      setReportPenalty(sub.reportPenalty || 0);
      setCodePenalty(sub.codePenalty || 0);
      setIsPlagiarised(Boolean(sub.isPlagiarised));
      setPlagiarismGroup(sub.plagiarismGroup || "");
      setCheckpointClaimed(Boolean(sub.checkpointClaimed));
      setRemark(sub.remark || "");
    } else {
      setAcceptanceScore("");
      setReportScore("");
      setCodeScore("");
      setReportPenalty(0);
      setCodePenalty(0);
      setIsPlagiarised(false);
      setPlagiarismGroup("");
      setCheckpointClaimed(Boolean(st.hasCheckpoint));
      setRemark(st.hasCheckpoint ? "申领了Checkpoint" : "");
    }
  };

  // Submit Grade
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedExpId) return;
    setSubmitting(true);
    setModalMessage("");

    try {
      const resp = await fetch(`/api/experiments/${selectedExpId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grade",
          studentId: selectedStudent.studentId,
          acceptanceScore: checkpointClaimed ? 0 : (acceptanceScore === "" ? null : parseFloat(acceptanceScore)),
          reportScore: checkpointClaimed ? 0 : (reportScore === "" ? null : parseFloat(reportScore)),
          codeScore: checkpointClaimed ? 0 : (codeScore === "" ? null : parseFloat(codeScore)),
          reportPenalty,
          codePenalty,
          isPlagiarised,
          plagiarismGroup,
          checkpointClaimed,
          remark
        })
      });

      const data = await resp.json();
      if (resp.ok) {
        // Refresh roster locally
        const updatedRoster = roster.map(item => {
          if (item.studentId === selectedStudent.studentId) {
            const acc = checkpointClaimed ? 0 : (acceptanceScore === "" ? null : parseFloat(acceptanceScore));
            const rep = checkpointClaimed ? 0 : (reportScore === "" ? null : parseFloat(reportScore));
            const cod = checkpointClaimed ? 0 : (codeScore === "" ? null : parseFloat(codeScore));

            let finalScore = null;
            if (checkpointClaimed) {
              finalScore = 0;
            } else if (currentExp && (acc !== null || rep !== null || cod !== null)) {
              const raw = (acc || 0) * currentExp.acceptanceRatio +
                          (rep || 0) * currentExp.reportRatio +
                          (cod || 0) * currentExp.codeRatio;
              finalScore = Math.max(0, Math.round((raw - reportPenalty - codePenalty) * 10) / 10);
            }

            return {
              ...item,
              submission: {
                ...item.submission,
                acceptanceScore: acc,
                reportScore: rep,
                codeScore: cod,
                reportPenalty,
                codePenalty,
                isPlagiarised,
                plagiarismGroup,
                checkpointClaimed,
                remark,
                finalScore
              }
            };
          }
          return item;
        });
        setRoster(updatedRoster);
        setSelectedStudent(null);
      } else {
        setModalMessage("❌ 保存失败: " + data.error);
      }
    } catch (err: any) {
      setModalMessage("❌ 错误: " + err.message);
    }
    setSubmitting(false);
  };

  // Plagiarism Check
  const handlePlagiarismCheck = async () => {
    if (!selectedExpId) return;
    setTopMessage("正在运行代码查重工具 (sim_c++)...");
    try {
      const resp = await fetch(`/api/experiments/${selectedExpId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_plagiarism" })
      });
      const data = await resp.json();
      if (resp.ok) {
        setTopMessage(`✅ 查重运行完毕！${data.count > 0 ? `发现 ${data.count} 份代码高度相似。` : "未发现超标雷同或尚无待测提交代码。"}`);
      } else {
        setTopMessage(`❌ 查重失败: ${data.error}`);
      }
    } catch (err: any) {
      setTopMessage(`❌ 查重调用异常: ${err.message}`);
    }
  };

  // Live preview of calculated score inside modal
  const previewScore = useMemo(() => {
    if (checkpointClaimed) return 0;
    if (!currentExp) return 0;
    const acc = parseFloat(acceptanceScore) || 0;
    const rep = parseFloat(reportScore) || 0;
    const cod = parseFloat(codeScore) || 0;
    const raw = acc * currentExp.acceptanceRatio + rep * currentExp.reportRatio + cod * currentExp.codeRatio;
    return Math.max(0, Math.round((raw - reportPenalty - codePenalty) * 10) / 10);
  }, [currentExp, acceptanceScore, reportScore, codeScore, reportPenalty, codePenalty, checkpointClaimed]);

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return roster.filter(st => {
      const matchesSearch =
        st.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const sub = st.submission;
      const isGraded = sub && (sub.acceptanceScore !== null || sub.reportScore !== null || sub.codeScore !== null);
      const isPlag = sub && sub.isPlagiarised;

      if (filterStatus === "GRADED") return isGraded;
      if (filterStatus === "PENDING") return !isGraded;
      if (filterStatus === "PLAGIARISED") return isPlag;
      return true;
    });
  }, [roster, searchQuery, filterStatus]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">
              {role === "TEACHER" ? "学生作业与成绩查看" : "实验作业批改台"}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${role === "TEACHER" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"}`}>
              {role === "TEACHER" ? "教师视察 (只读)" : "助教批改"}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            {role === "TEACHER"
              ? "查看全体学生各实验阶段现场验收、报告、代码成绩明细与查重分析（教师端为只读权限）。"
              : "选择实验项目，录入学生验收、报告与代码成绩，支持单项扣分与 sim_c++ 查重。"}
          </p>
        </div>

        {role === "TA" && (
          <button
            onClick={handlePlagiarismCheck}
            className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl font-medium text-sm transition flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.332.192 3 1.732 3z" />
            </svg>
            执行代码查重 (sim_c++)
          </button>
        )}
      </div>

      {topMessage && (
        <div className="p-4 rounded-xl bg-white/10 border border-white/10 text-sm font-medium flex justify-between items-center">
          <span>{topMessage}</span>
          <button onClick={() => setTopMessage("")} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition">✕</button>
        </div>
      )}

      {/* Experiment Selector Bar */}
      <div className="glass p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-sm font-medium text-zinc-300 whitespace-nowrap">当前实验:</label>
          <select
            value={selectedExpId}
            onChange={e => setSelectedExpId(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-800 border border-white/10 text-zinc-100 text-sm font-semibold focus:outline-none focus:border-sky-500"
          >
            {experiments.map(exp => (
              <option key={exp.id} value={exp.id}>
                {exp.number} - {exp.name}
              </option>
            ))}
          </select>
        </div>

        {currentExp && (
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span>满分: {currentExp.totalScore}</span>
            <span>|</span>
            <span>权重: 验收({currentExp.acceptanceRatio * 100}%) / 报告({currentExp.reportRatio * 100}%) / 代码({currentExp.codeRatio * 100}%)</span>
          </div>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 text-xs">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`px-3 py-1.5 rounded-lg transition font-medium ${filterStatus === 'ALL' ? 'bg-sky-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            全部 ({roster.length})
          </button>
          <button
            onClick={() => setFilterStatus("GRADED")}
            className={`px-3 py-1.5 rounded-lg transition font-medium ${filterStatus === 'GRADED' ? 'bg-sky-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            已评分 ({roster.filter(r => r.submission && (r.submission.acceptanceScore !== null || r.submission.reportScore !== null || r.submission.codeScore !== null)).length})
          </button>
          <button
            onClick={() => setFilterStatus("PENDING")}
            className={`px-3 py-1.5 rounded-lg transition font-medium ${filterStatus === 'PENDING' ? 'bg-sky-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            待批改 ({roster.filter(r => !r.submission || (r.submission.acceptanceScore === null && r.submission.reportScore === null && r.submission.codeScore === null)).length})
          </button>
          <button
            onClick={() => setFilterStatus("PLAGIARISED")}
            className={`px-3 py-1.5 rounded-lg transition font-medium ${filterStatus === 'PLAGIARISED' ? 'bg-red-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            查重告警 ({roster.filter(r => r.submission && r.submission.isPlagiarised).length})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="搜索学号或姓名..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Roster Table */}
      <div className="glass rounded-2xl overflow-hidden border border-white/10">
        {loading ? (
          <div className="py-16 text-center text-zinc-400">加载学生成绩名册中...</div>
        ) : filteredRoster.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">未找到匹配的学生记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 border-b border-white/10 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">学号</th>
                  <th className="px-6 py-3.5">姓名</th>
                  <th className="px-6 py-3.5">现场验收</th>
                  <th className="px-6 py-3.5">实验报告</th>
                  <th className="px-6 py-3.5">源代码</th>
                  <th className="px-6 py-3.5">罚分</th>
                  <th className="px-6 py-3.5">最终总分</th>
                  <th className="px-6 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRoster.map(st => {
                  const sub = st.submission;
                  const isGraded = sub && (sub.acceptanceScore !== null || sub.reportScore !== null || sub.codeScore !== null);

                  return (
                    <tr key={st.id} className="hover:bg-white/5 transition">
                      <td className="px-6 py-4 font-mono font-medium text-zinc-200">{st.studentId}</td>
                      <td className="px-6 py-4 font-medium text-zinc-100">
                        {st.name}
                        {(st.hasCheckpoint || sub?.checkpointClaimed) && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            Checkpoint
                          </span>
                        )}
                        {sub?.isPlagiarised && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-bold">
                            查重
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-300">{sub?.acceptanceScore ?? "-"}</td>
                      <td className="px-6 py-4 font-mono text-zinc-300">{sub?.reportScore ?? "-"}</td>
                      <td className="px-6 py-4 font-mono text-zinc-300">{sub?.codeScore ?? "-"}</td>
                      <td className="px-6 py-4 font-mono">
                        {(sub?.reportPenalty > 0 || sub?.codePenalty > 0) ? (
                          <span className="text-red-400">-{(sub.reportPenalty || 0) + (sub.codePenalty || 0)}</span>
                        ) : (
                          <span className="text-zinc-500">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {sub?.checkpointClaimed ? (
                          <span className="font-mono font-bold text-amber-400 text-xs block">
                            0 分 (已申领Checkpoint)
                          </span>
                        ) : isGraded ? (
                          <span className="font-mono font-bold text-sky-400 text-base">
                            {sub.finalScore}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">待批改</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {role === "TEACHER" ? (
                          <button
                            onClick={() => handleOpenGradeModal(st)}
                            className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-xs font-semibold transition"
                          >
                            查看详情
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenGradeModal(st)}
                            className="px-3.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500 hover:text-white text-sky-300 border border-sky-500/30 text-xs font-semibold transition"
                          >
                            {isGraded ? "修改评分" : "录入成绩"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grading Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 md:p-8 rounded-2xl max-w-lg w-full space-y-6 border border-white/20">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">
                  {role === "TEACHER" ? "成绩详情 (只读)" : "评分"}: {selectedStudent.name} ({selectedStudent.studentId})
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {currentExp?.number} - {currentExp?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {modalMessage && (
              <div className="p-3 rounded-xl bg-red-500/20 text-red-300 text-sm">
                {modalMessage}
              </div>
            )}

            <form onSubmit={handleSaveGrade} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    现场验收 ({currentExp ? currentExp.acceptanceRatio * 100 : 40}%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={acceptanceScore}
                    onChange={e => setAcceptanceScore(e.target.value)}
                    disabled={role === "TEACHER"}
                    placeholder="0-100"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    实验报告 ({currentExp ? currentExp.reportRatio * 100 : 30}%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={reportScore}
                    onChange={e => setReportScore(e.target.value)}
                    disabled={role === "TEACHER"}
                    placeholder="0-100"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    源代码 ({currentExp ? currentExp.codeRatio * 100 : 30}%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={codeScore}
                    onChange={e => setCodeScore(e.target.value)}
                    disabled={role === "TEACHER"}
                    placeholder="0-100"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Penalties */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">报告罚分 (如迟交)</label>
                  <input
                    type="number"
                    min="0"
                    value={reportPenalty}
                    onChange={e => setReportPenalty(parseFloat(e.target.value) || 0)}
                    disabled={role === "TEACHER"}
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm font-mono text-red-300 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">代码罚分</label>
                  <input
                    type="number"
                    min="0"
                    value={codePenalty}
                    onChange={e => setCodePenalty(parseFloat(e.target.value) || 0)}
                    disabled={role === "TEACHER"}
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm font-mono text-red-300 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Plagiarism Tag */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <label className={`flex items-center gap-2 text-xs font-medium text-zinc-300 ${role === "TEACHER" ? "cursor-default" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={isPlagiarised}
                    onChange={e => setIsPlagiarised(e.target.checked)}
                    disabled={role === "TEACHER"}
                    className="rounded text-red-500 focus:ring-red-400 disabled:opacity-75"
                  />
                  <span>标记为疑似抄袭 / 雷同作业</span>
                </label>
                {isPlagiarised && (
                  <input
                    type="text"
                    value={plagiarismGroup}
                    onChange={e => setPlagiarismGroup(e.target.value)}
                    disabled={role === "TEACHER"}
                    placeholder="雷同组备注 (如: 与 324010xxxx 代码相似 85%)..."
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-red-500/30 text-xs text-red-200 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                )}
              </div>

              {/* Checkpoint Tag */}
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <label className={`flex items-center gap-2 text-xs font-medium text-amber-300 ${role === "TEACHER" ? "cursor-default" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={checkpointClaimed}
                    onChange={e => setCheckpointClaimed(e.target.checked)}
                    disabled={role === "TEACHER"}
                    className="rounded text-amber-500 focus:ring-amber-400 disabled:opacity-75"
                  />
                  <span>标记为申领了 Checkpoint（免做本实验，总分记 0 分）</span>
                </label>
                {checkpointClaimed && (
                  <input
                    type="text"
                    value={remark}
                    onChange={e => setRemark(e.target.value)}
                    disabled={role === "TEACHER"}
                    placeholder="备注原因 (如: 申领了Checkpoint)..."
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-amber-500/30 text-xs text-amber-200 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                )}
              </div>

              {/* Live Preview */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <span className="text-sm font-semibold text-sky-400">加权折算总分</span>
                <span className="text-2xl font-bold font-mono text-sky-300">{previewScore} 分</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                {role === "TEACHER" ? (
                  <span className="text-xs text-amber-400 font-medium">
                    ℹ️ 教师端为只读视察模式，实验评分由助教团队执行。
                  </span>
                ) : <div />}

                <div className="flex gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"
                  >
                    {role === "TEACHER" ? "关闭" : "取消"}
                  </button>
                  {role === "TA" && (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold shadow transition disabled:opacity-50"
                    >
                      {submitting ? "正在保存..." : "保存评分"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-zinc-400">加载中...</div>}>
      <AssignmentsContent />
    </Suspense>
  );
}
