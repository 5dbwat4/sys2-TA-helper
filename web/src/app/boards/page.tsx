"use client";

import { useEffect, useState, useMemo } from "react";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

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

  // Create Board Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTab, setCreateTab] = useState<"SINGLE" | "BATCH">("SINGLE");
  const [newAssetNo, setNewAssetNo] = useState("");
  const [newDbNo, setNewDbNo] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [keepAdding, setKeepAdding] = useState(true);
  const [scanningField, setScanningField] = useState<"assetNo" | "dbNo" | null>(null);

  // Batch create
  const [batchText, setBatchText] = useState("");

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

  const borrowedCount = useMemo(() => boards.filter(b => b.isBorrowed).length, [boards]);
  const availableCount = useMemo(() => boards.filter(b => !b.isBorrowed).length, [boards]);

  // Open Assign Modal
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

  // Submit Assign
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

  // Open Create Modal
  const handleOpenCreate = () => {
    setMessage("");
    setNewAssetNo("");
    setNewDbNo("");
    setNewContactPhone("");
    setBatchText("");
    setScanningField(null);
    setShowCreateModal(true);
  };

  // Submit Single Board Create
  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetNo.trim() || !newDbNo.trim()) {
      setMessage("❌ 资产编号和 DB 编号为必填项");
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const resp = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          assetNo: newAssetNo.trim(),
          dbNo: newDbNo.trim(),
          contactPhone: newContactPhone.trim() || null
        })
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        setMessage(`✓ 成功录入开发板: ${data.board.dbNo} (${data.board.assetNo})`);
        loadBoards();

        if (keepAdding) {
          setNewAssetNo("");
          setNewDbNo("");
          setNewContactPhone("");
        } else {
          setShowCreateModal(false);
        }
      } else {
        setMessage("❌ 录入失败: " + (data.error || "未知错误"));
      }
    } catch (err: any) {
      setMessage("❌ 网络错误: " + err.message);
    }
    setActionLoading(false);
  };

  // Submit Batch Boards Create
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = batchText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setMessage("❌ 请在文本框中输入要批量录入的开发板信息");
      return;
    }

    const parsedList = lines.map(line => {
      // Support comma, tab, or space separation
      const parts = line.split(/[,\t\s]+/).filter(Boolean);
      return {
        assetNo: parts[0] || "",
        dbNo: parts[1] || "",
        contactPhone: parts[2] || null
      };
    });

    setActionLoading(true);
    setMessage("");

    try {
      const resp = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_create",
          boards: parsedList
        })
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        let msg = `✓ 批量录入完成！成功录入 ${data.createdCount} 块开发板。`;
        if (data.skipped?.length > 0) {
          msg += ` (跳过 ${data.skipped.length} 块重复或格式错误项)`;
        }
        setMessage(msg);
        loadBoards();
        setBatchText("");
      } else {
        setMessage("❌ 批量录入失败: " + (data.error || "未知错误"));
      }
    } catch (err: any) {
      setMessage("❌ 网络错误: " + err.message);
    }
    setActionLoading(false);
  };

  // Return Board
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

  // Delete Board
  const handleDeleteBoard = async (board: any) => {
    if (!confirm(`确定要从系统中彻底删除开发板 [${board.dbNo}] (资产号: ${board.assetNo}) 吗？`)) {
      return;
    }

    try {
      const resp = await fetch(`/api/boards?id=${board.id}`, {
        method: "DELETE"
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        alert(data.message);
        loadBoards();
      } else {
        alert("删除失败: " + (data.error || "未知错误"));
      }
    } catch (err: any) {
      alert("网络异常: " + err.message);
    }
  };

  // Camera scanned barcode handler for Add Board
  const handleCameraScan = (code: string) => {
    if (scanningField === "assetNo") {
      setNewAssetNo(code);
      setScanningField(null);
    } else if (scanningField === "dbNo") {
      setNewDbNo(code);
      setScanningField(null);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">开发板管理台</h1>
            <div className="flex gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                共 {boards.length} 块
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                在库 {availableCount} 块
              </span>
              {borrowedCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  借出 {borrowedCount} 块
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            追踪 {boards.length} 块 FPGA 开发板借还状态，支持扫码借还、新板入库登记与钉钉机器人动态推送。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Add New Board Button */}
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-md font-semibold transition flex items-center gap-1.5 text-sm"
          >
            <span className="text-base">＋</span>
            <span>新建开发板 (New Board)</span>
          </button>

          {/* Continuous Return Barcode */}
          <a
            href="/boards/return"
            className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl font-semibold transition flex items-center gap-2 text-sm shadow-sm"
          >
            <span>📷</span>
            <span>连续扫码还板 (Return)</span>
          </a>

          {/* Assign Board */}
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
            借用中 ({borrowedCount})
          </button>
          <button
            onClick={() => setFilterStatus("AVAILABLE")}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium ${filterStatus === 'AVAILABLE' ? 'bg-emerald-500 text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`}
          >
            在库可用 ({availableCount})
          </button>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="搜索资产号、DB编号、学生姓名或学号..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Boards List */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-400">正在载入开发板数据...</div>
        ) : filteredBoards.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            暂无匹配的开发板数据。若有新购置的开发板，请点击右上角【新建开发板】进行入库。
          </div>
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
                      <div className="flex items-center justify-end gap-2">
                        {b.isBorrowed ? (
                          <button
                            onClick={() => handleReturn(b.dbNo)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                          >
                            确认归还
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenAssign(b)}
                              className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500 hover:text-white text-teal-300 border border-teal-500/30 text-xs font-semibold transition"
                            >
                              借出登记
                            </button>
                            <button
                              onClick={() => handleDeleteBoard(b)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-400 text-xs transition"
                              title="删除未借出开发板"
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Create New Board (Single & Batch) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 md:p-8 rounded-2xl max-w-lg w-full space-y-6 border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h2 className="text-xl font-bold text-zinc-100">录入新开发板</h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setScanningField(null);
                }}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => {
                  setCreateTab("SINGLE");
                  setMessage("");
                  setScanningField(null);
                }}
                className={`flex-1 py-1.5 rounded-lg transition font-semibold text-center ${
                  createTab === "SINGLE"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                单个快速录入 (支持扫码)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateTab("BATCH");
                  setMessage("");
                  setScanningField(null);
                }}
                className={`flex-1 py-1.5 rounded-lg transition font-semibold text-center ${
                  createTab === "BATCH"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                批量粘贴导入 (Batch)
              </button>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-sm font-medium border ${
                  message.startsWith("✓")
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-red-500/20 text-red-300 border-red-500/30"
                }`}
              >
                {message}
              </div>
            )}

            {/* Single Board Entry Form */}
            {createTab === "SINGLE" && (
              <form onSubmit={handleCreateSingle} className="space-y-4">
                {/* Camera Scanner View if active */}
                {scanningField && (
                  <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/40 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        正在扫描【{scanningField === "assetNo" ? "资产编号" : "DB 编号"}】条形码...
                      </span>
                      <button
                        type="button"
                        onClick={() => setScanningField(null)}
                        className="text-zinc-400 hover:text-white"
                      >
                        关闭摄像头
                      </button>
                    </div>
                    <CameraBarcodeScanner
                      onDetected={handleCameraScan}
                      onClose={() => setScanningField(null)}
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      资产编号 (Asset No) <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setScanningField(scanningField === "assetNo" ? null : "assetNo")}
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <span>📷</span> 扫码填入
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newAssetNo}
                    onChange={e => setNewAssetNo(e.target.value)}
                    placeholder="如: 2403248A 或贴纸上的学校资产条码"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      DB 编号 (DB No) <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setScanningField(scanningField === "dbNo" ? null : "dbNo")}
                      className="text-xs text-teal-400 hover:underline flex items-center gap-1"
                    >
                      <span>📷</span> 扫码填入
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newDbNo}
                    onChange={e => setNewDbNo(e.target.value)}
                    placeholder="如: DB040A 或 DBCFBC2"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    联系电话 / 负责人备注 (选填)
                  </label>
                  <input
                    type="text"
                    value={newContactPhone}
                    onChange={e => setNewContactPhone(e.target.value)}
                    placeholder="选填，如暂存实验室或联系电话"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="keepAdding"
                    checked={keepAdding}
                    onChange={e => setKeepAdding(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-white/5 border-white/10"
                  />
                  <label htmlFor="keepAdding" className="text-xs text-zinc-300 select-none cursor-pointer">
                    保存后清空并继续录入下一块开发板（适合拆箱连续入库）
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setScanningField(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"
                  >
                    完成 / 关闭
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow transition disabled:opacity-50"
                  >
                    {actionLoading ? "保存中..." : "确认入库 (Save Board)"}
                  </button>
                </div>
              </form>
            )}

            {/* Batch Entry Form */}
            {createTab === "BATCH" && (
              <form onSubmit={handleCreateBatch} className="space-y-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 space-y-1">
                  <p className="font-semibold text-blue-400">📝 批量格式说明：</p>
                  <p>每行输入一块开发板，字段用逗号、空格或制表符隔开：</p>
                  <p className="font-mono text-zinc-400">资产号, DB号, 备注电话(选填)</p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setBatchText("2403248A, DB040A\n2403249A, DB041A\n2403250A, DB042A")}
                      className="text-sky-400 hover:underline text-[11px]"
                    >
                      填入示例数据
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    粘贴多行数据
                  </label>
                  <textarea
                    rows={6}
                    value={batchText}
                    onChange={e => setBatchText(e.target.value)}
                    placeholder={`2403248A, DB040A\n2403249A, DB041A\n2403250A, DB042A`}
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !batchText.trim()}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow transition disabled:opacity-50"
                  >
                    {actionLoading ? "导入中..." : "批量确认入库"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Assign Modal */}
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
