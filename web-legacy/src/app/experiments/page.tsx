"use client";

import { useEffect, useState } from "react";

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [role, setRole] = useState("STUDENT");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // New Experiment Form state
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("HARDWARE");
  const [publishDate, setPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [totalScore, setTotalScore] = useState(100);
  const [acceptanceRatio, setAcceptanceRatio] = useState(0.4);
  const [reportRatio, setReportRatio] = useState(0.3);
  const [codeRatio, setCodeRatio] = useState(0.3);
  const [questions, setQuestions] = useState<string[]>([""]);

  const loadData = () => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) setRole(data.user.role);
      });
      
    fetch('/api/experiments')
      .then(res => res.json())
      .then(data => {
        if (data.success) setExperiments(data.experiments);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePublish = async (id: string, publish: boolean) => {
    try {
      const resp = await fetch('/api/experiments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isPublished: publish, syncZju: false })
      });
      if (resp.ok) {
        loadData();
      }
    } catch {}
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, val: string) => {
    const updated = [...questions];
    updated[index] = val;
    setQuestions(updated);
  };

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const sum = Math.round((acceptanceRatio + reportRatio + codeRatio) * 100) / 100;
    if (sum !== 1.0) {
      setMessage("⚠️ 验收、报告、代码三个占比相加必须等于 1.0 (100%)");
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number,
          name,
          type,
          publishDate,
          dueDate,
          totalScore,
          acceptanceRatio,
          reportRatio,
          codeRatio,
          questions: questions.filter(q => q.trim().length > 0)
        })
      });

      const data = await resp.json();
      if (resp.ok) {
        setShowModal(false);
        setNumber("");
        setName("");
        setQuestions([""]);
        loadData();
      } else {
        setMessage("❌ 创建失败: " + data.error);
      }
    } catch (err: any) {
      setMessage("❌ 错误: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">实验项目管理</h1>
          <p className="text-sm text-zinc-400 mt-1">
            浏览已发布的实验项目，设定评分标准并直接进行在线批改。
          </p>
        </div>

        {(role === "TA" || role === "TEACHER") && (
          <button
            onClick={() => { setShowModal(true); setMessage(""); }}
            className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl shadow-lg font-semibold transition flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            新增实验 (New Experiment)
          </button>
        )}
      </div>

      {/* Experiments List */}
      <div className="space-y-4">
        {experiments.length === 0 ? (
          <div className="glass p-12 text-center text-zinc-400 rounded-2xl">
            暂无已发布的实验，请点击右上角按钮新增实验。
          </div>
        ) : (
          experiments.map(exp => (
            <div key={exp.id} className="glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-white/20 transition">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-300 font-mono">
                    {exp.number}
                  </span>
                  <h2 className="text-xl font-semibold text-zinc-100">{exp.name}</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded bg-white/10 text-zinc-300">
                    {exp.type === 'HARDWARE' ? '硬件实验' : exp.type === 'SOFTWARE' ? '软件实验' : '软硬件综合'}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded font-medium ${exp.isPublished ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'}`}>
                    {exp.isPublished ? '已发布 (学生可见)' : '待发布 (草稿)'}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                  <span>发布日期: {new Date(exp.publishDate).toLocaleDateString()}</span>
                  <span>截止日期: {new Date(exp.dueDate).toLocaleDateString()}</span>
                  <span>满分: {exp.totalScore}分</span>
                  <span>
                    权重: 验收({exp.acceptanceRatio * 100}%) / 报告({exp.reportRatio * 100}%) / 代码({exp.codeRatio * 100}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                {(role === "TA" || role === "TEACHER") && (
                  <>
                    <button
                      onClick={() => handleTogglePublish(exp.id, !exp.isPublished)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${exp.isPublished ? 'bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow'}`}
                    >
                      {exp.isPublished ? '撤回为草稿' : '发布实验'}
                    </button>
                    <a
                      href={`/assignments?experimentId=${exp.id}`}
                      className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-white rounded-xl text-sm font-medium transition text-center"
                    >
                      前往批改 (Grade)
                    </a>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Experiment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 md:p-8 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 border border-white/20">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h2 className="text-2xl font-bold text-zinc-100">新增实验项目</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {message && (
              <div className="p-3 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-sm">
                {message}
              </div>
            )}

            <form onSubmit={handleCreateExperiment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">实验编号 (如: Exp 1 / 实验一)</label>
                  <input
                    type="text"
                    value={number}
                    onChange={e => setNumber(e.target.value)}
                    placeholder="实验一"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">实验名称</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="单周期 MIPS CPU 设计"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-500 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">实验类型</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-white/10 focus:outline-none focus:border-sky-500 text-sm text-zinc-200"
                  >
                    <option value="HARDWARE">硬件实验 (FPGA/Vivado)</option>
                    <option value="SOFTWARE">软件实验 (C/C++/Linux)</option>
                    <option value="BOTH">软硬件综合</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">发布日期</label>
                  <input
                    type="date"
                    value={publishDate}
                    onChange={e => setPublishDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-500 text-sm text-zinc-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">截止日期</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-sky-500 text-sm text-zinc-200"
                    required
                  />
                </div>
              </div>

              {/* Ratios */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <span className="text-xs font-semibold text-zinc-300 block">成绩占比配置 (总和必须等于 1.0)</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">现场验收占比</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={acceptanceRatio}
                      onChange={e => setAcceptanceRatio(parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">报告占比</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={reportRatio}
                      onChange={e => setReportRatio(parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">代码占比</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={codeRatio}
                      onChange={e => setCodeRatio(parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Thinking Questions */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-zinc-300">思考题 / 检查点 (选填)</label>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    + 添加思考题
                  </button>
                </div>
                {questions.map((q, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={q}
                      onChange={e => handleQuestionChange(idx, e.target.value)}
                      placeholder={`思考题 ${idx + 1}...`}
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
                    />
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        className="px-3 text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
                >
                  {loading ? "正在创建..." : "确认发布"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
