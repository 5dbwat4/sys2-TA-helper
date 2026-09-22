"use client";

import { useEffect, useState, useMemo } from "react";

export default function BoardsPage() {
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "BORROWED" | "AVAILABLE">("ALL");

  // Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<any>(null);
  const [studentId, setStudentId] = useState("");
  const [assignDbNo, setAssignDbNo] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadBoards = () => {
    fetch('/api/boards')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBoards(data.boards);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadBoards();
  }, []);

  const handleOpenAssign = (board?: any) => {
    setMessage("");
    if (board) {
      setSelectedBoard(board);
      setAssignDbNo(board.dbNo);
    } else {
      setSelectedBoard(null);
      setAssignDbNo("");
    }
    setStudentId("");
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setMessage("");
    try {
      const resp = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, dbNo: assignDbNo })
      });
      const data = await resp.json();
      if (resp.ok) {
        setShowAssignModal(false);
        loadBoards();
      } else {
        setMessage("❌ 登记失败: " + data.error);
      }
    } catch (err: any) {
      setMessage("❌ 错误: " + err.message);
    }
    setActionLoading(false);
  };

  const handleReturn = async (dbNo: string) => {
    if (!confirm(`确认归还编号为 ${dbNo} 的开发板吗？`)) return;
    try {
      const resp = await fetch("/api/boards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbNo })
      });
      const data = await resp.json();
      if (resp.ok) {
        loadBoards();
      } else {
        alert("归还失败: " + data.error);
      }
    } catch (err: any) {
      alert("操作异常: " + err.message);
    }
  };

  const filteredBoards = useMemo(() => {
    return boards.filter(b => {
      const matchesSearch =
        b.assetNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.dbNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.currentStudent?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.currentStudent?.studentId || "").toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStatus === "BORROWED") return b.isBorrowed;
      if (filterStatus === "AVAILABLE") return !b.isBorrowed;
      return true;
    });
  }, [boards, searchQuery, filterStatus]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">开发板管理台</h1>
          <p className="text-sm text-zinc-400 mt-1">
            追踪 30 块 FPGA 开发板借还状态，支持扫码登记与钉钉机器人动态推送。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/boards/return"
            className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl font-semibold transition flex items-center gap-2 text-sm shadow-sm"
          >
            <span>📷</span>
            <span>连续扫码还板 (Return)</span>
          </a>
          <button
            onClick={() => handleOpenAssign()}
            className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl shadow-lg font-semibold transition flex items-center gap-2 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            登记借板 (Assign Board)
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 text-xs">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium ${filterStatus === 'ALL' ? 'bg-teal-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            全部板卡 ({boards.length})
          </button>
          <button
            onClick={() => setFilterStatus("BORROWED")}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium ${filterStatus === 'BORROWED' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            借用中 ({boards.filter(b => b.isBorrowed).length})
          </button>
          <button
            onClick={() => setFilterStatus("AVAILABLE")}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium ${filterStatus === 'AVAILABLE' ? 'bg-emerald-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            在库可用 ({boards.filter(b => !b.isBorrowed).length})
          </button>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="搜索资产号、DB编号、借用人..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Boards Table */}
      <div className="glass rounded-2xl overflow-hidden border border-white/10">
        {loading ? (
          <div className="py-16 text-center text-zinc-400">加载开发板资产列表中...</div>
        ) : filteredBoards.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">未找到匹配的开发板资产</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 border-b border-white/10 text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">资产编号</th>
                  <th className="px-6 py-3.5">DB 编号</th>
                  <th className="px-6 py-3.5">当前状态</th>
                  <th className="px-6 py-3.5">当前借用人</th>
                  <th className="px-6 py-3.5">借出时间</th>
                  <th className="px-6 py-3.5">联系电话</th>
                  <th className="px-6 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBoards.map(b => (
                  <tr key={b.id} className="hover:bg-white/5 transition">
                    <td className="px-6 py-4 font-mono font-bold text-sky-400">{b.assetNo}</td>
                    <td className="px-6 py-4 font-mono text-zinc-200">{b.dbNo}</td>
                    <td className="px-6 py-4">
                      {b.isBorrowed ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          借用中
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          在库可用
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {b.isBorrowed && b.currentStudent ? (
                        <div>
                          <span className="font-semibold text-zinc-100">{b.currentStudent.name}</span>
                          <span className="text-xs text-zinc-400 font-mono ml-2">({b.currentStudent.studentId})</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-400">
                      {b.isBorrowed && b.currentStudent?.assignedAt
                        ? new Date(b.currentStudent.assignedAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                      {b.contactPhone || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {b.isBorrowed ? (
                        <button
                          onClick={() => handleReturn(b.dbNo)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                        >
                          确认归还
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenAssign(b)}
                          className="px-3.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500 hover:text-white text-teal-300 border border-teal-500/30 text-xs font-semibold transition"
                        >
                          借出登记
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 md:p-8 rounded-2xl max-w-md w-full space-y-6 border border-white/20">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h2 className="text-xl font-bold text-zinc-100">
                {selectedBoard ? `借出开发板: ${selectedBoard.dbNo}` : "登记借出开发板"}
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {message && (
              <div className="p-3 rounded-xl bg-red-500/20 text-red-300 text-sm">
                {message}
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">开发板 DB编号 或 资产号</label>
                <input
                  type="text"
                  value={assignDbNo}
                  onChange={e => setAssignDbNo(e.target.value)}
                  placeholder="如: DBD039A 或 24031188"
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">学生学号 (Student ID)</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="如: 3250105895"
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "登记中..." : "确认借出"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
