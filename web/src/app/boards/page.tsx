"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

export default function BoardsPage() {
  const [boards, setBoards] = useState<any[]>([]);
  const [studentsRoster, setStudentsRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "BORROWED" | "AVAILABLE">("ALL");

  // Assign / Edit Borrowers Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<any>(null);
  const [assignDbNo, setAssignDbNo] = useState("");
  const [primaryStudent, setPrimaryStudent] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [coStudents, setCoStudents] = useState<any[]>([]);
  const [coInput, setCoInput] = useState("");
  const [assignScanning, setAssignScanning] = useState(false);

  // Student suggestion dropdown state for primary student
  const [showPrimarySuggestions, setShowPrimarySuggestions] = useState(false);
  const [showCoSuggestions, setShowCoSuggestions] = useState(false);

  // Loading & Message
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Create Board Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTab, setCreateTab] = useState<"SINGLE" | "BATCH">("SINGLE");
  const [newAssetNo, setNewAssetNo] = useState("");
  const [newDbNo, setNewDbNo] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [keepAdding, setKeepAdding] = useState(true);
  const [createScanningField, setCreateScanningField] = useState<"assetNo" | "dbNo" | null>(null);
  const [batchText, setBatchText] = useState("");

  const loadBoards = () => {
    fetch('/api/boards')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBoards(data.boards);
          if (data.students) {
            setStudentsRoster(data.students);
          }
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

  // Open Assign Modal (works for new assignment OR editing existing co-borrowers/phone)
  const handleOpenAssign = (board?: any) => {
    setMessage("");
    if (board) {
      setSelectedBoard(board);
      setAssignDbNo(board.dbNo);
      setContactPhone(board.contactPhone || "");
      if (board.isBorrowed && board.currentStudent) {
        setPrimaryStudent(board.currentStudent.studentId);
        setCoStudents(board.coBorrowers || []);
      } else {
        setPrimaryStudent("");
        setCoStudents([]);
      }
    } else {
      setSelectedBoard(null);
      setAssignDbNo("");
      setPrimaryStudent("");
      setContactPhone("");
      setCoStudents([]);
    }
    setCoInput("");
    setAssignScanning(false);
    setShowPrimarySuggestions(false);
    setShowCoSuggestions(false);
    setShowAssignModal(true);
  };

  // Add co-borrower
  const handleAddCoStudent = (st: any) => {
    if (!st) return;
    const exists = coStudents.some(c => c.studentId === st.studentId || c.name === st.name);
    if (!exists) {
      setCoStudents([...coStudents, st]);
    }
    setCoInput("");
    setShowCoSuggestions(false);
  };

  // Remove co-borrower
  const handleRemoveCoStudent = (studentId: string) => {
    setCoStudents(coStudents.filter(c => c.studentId !== studentId));
  };

  // Suggestions for Primary Student
  const primarySuggestions = useMemo(() => {
    if (!primaryStudent.trim()) return [];
    const q = primaryStudent.toLowerCase().trim();
    return studentsRoster
      .filter(s => s.studentId.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [primaryStudent, studentsRoster]);

  // Suggestions for Co-Borrower
  const coSuggestions = useMemo(() => {
    if (!coInput.trim()) return [];
    const q = coInput.toLowerCase().trim();
    return studentsRoster
      .filter(s => s.studentId.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .filter(s => s.studentId !== primaryStudent)
      .slice(0, 6);
  }, [coInput, studentsRoster, primaryStudent]);

  // Submit Assign
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignDbNo.trim()) {
      setMessage("❌ 请输入或扫描开发板编号");
      return;
    }
    if (!primaryStudent.trim()) {
      setMessage("❌ 请输入主借用人学号或姓名");
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const resp = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbNo: assignDbNo.trim(),
          studentId: primaryStudent.trim(),
          contactPhone: contactPhone.trim() || null,
          coStudents: coStudents.map(c => c.studentId)
        })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setShowAssignModal(false);
        loadBoards();
      } else {
        setMessage("❌ 登记失败: " + (data.error || "未知错误"));
      }
    } catch (err: any) {
      setMessage("❌ 错误: " + err.message);
    }
    setActionLoading(false);
  };

  // Open Create Board Modal
  const handleOpenCreate = () => {
    setMessage("");
    setNewAssetNo("");
    setNewDbNo("");
    setNewContactPhone("");
    setBatchText("");
    setCreateScanningField(null);
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
  const handleCreateCameraScan = (code: string) => {
    if (createScanningField === "assetNo") {
      setNewAssetNo(code);
      setCreateScanningField(null);
    } else if (createScanningField === "dbNo") {
      setNewDbNo(code);
      setCreateScanningField(null);
    }
  };

  // Camera scanned barcode handler for Assign Board
  const handleAssignCameraScan = (code: string) => {
    setAssignDbNo(code);
    setAssignScanning(false);
  };

  const filteredBoards = useMemo(() => {
    return boards.filter(b => {
      const matchesSearch =
        b.assetNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.dbNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.contactPhone || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.currentStudent?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.currentStudent?.studentId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.teamMembers || []).some((m: string) => m.toLowerCase().includes(searchQuery.toLowerCase()));

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
            追踪 {boards.length} 块 FPGA 开发板借还状态，支持登记借用（主借用人、多名共用组员与联系电话）、新板入库与连续扫码还板。
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

        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="搜索资产号、DB号、借用人、共用人或电话..."
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
                  <th className="px-5 py-3.5">资产编号</th>
                  <th className="px-5 py-3.5">DB 编号</th>
                  <th className="px-5 py-3.5">当前状态</th>
                  <th className="px-5 py-3.5">借用人 (主借用人)</th>
                  <th className="px-5 py-3.5">组内共用人</th>
                  <th className="px-5 py-3.5">借用联系电话</th>
                  <th className="px-5 py-3.5">借出时间</th>
                  <th className="px-5 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBoards.map(b => (
                  <tr key={b.id} className="hover:bg-white/5 transition">
                    <td className="px-5 py-4 font-mono font-bold text-sky-400">{b.assetNo}</td>
                    <td className="px-5 py-4 font-mono text-zinc-200">{b.dbNo}</td>
                    <td className="px-5 py-4">
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
                    <td className="px-5 py-4">
                      {b.isBorrowed && b.currentStudent ? (
                        <div>
                          <span className="font-semibold text-zinc-100">{b.currentStudent.name}</span>
                          <span className="text-xs text-zinc-400 font-mono ml-1.5">({b.currentStudent.studentId})</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {b.isBorrowed && b.teamMembers && b.teamMembers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {b.coBorrowers ? (
                            b.coBorrowers.map((c: any) => (
                              <span
                                key={c.studentId}
                                className="px-2 py-0.5 rounded-md text-[11px] bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium"
                                title={`学号: ${c.studentId}`}
                              >
                                {c.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-300 font-medium">
                              {b.teamMembers.join(", ")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-xs">独立实验 (无共用)</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {b.contactPhone ? (
                        <a
                          href={`tel:${b.contactPhone}`}
                          className="text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>📞</span>
                          <span>{b.contactPhone}</span>
                        </a>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-zinc-400">
                      {b.isBorrowed && b.currentStudent?.assignedAt
                        ? new Date(b.currentStudent.assignedAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {b.isBorrowed ? (
                          <>
                            <button
                              onClick={() => handleReturn(b.dbNo)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                            >
                              确认归还
                            </button>
                            <button
                              onClick={() => handleOpenAssign(b)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 text-xs font-medium border border-white/10 transition"
                              title="修改借用人、添加组内共用人或更新联系电话"
                            >
                              修改共用/信息
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenAssign(b)}
                              className="px-3.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500 hover:text-white text-teal-300 border border-teal-500/30 text-xs font-semibold transition"
                            >
                              登记借出
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
                  setCreateScanningField(null);
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
                  setCreateScanningField(null);
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
                  setCreateScanningField(null);
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
                {createScanningField && (
                  <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/40 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        正在扫描【{createScanningField === "assetNo" ? "资产编号" : "DB 编号"}】条形码...
                      </span>
                      <button
                        type="button"
                        onClick={() => setCreateScanningField(null)}
                        className="text-zinc-400 hover:text-white"
                      >
                        关闭摄像头
                      </button>
                    </div>
                    <CameraBarcodeScanner
                      onDetected={handleCreateCameraScan}
                      onClose={() => setCreateScanningField(null)}
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
                      onClick={() => setCreateScanningField(createScanningField === "assetNo" ? null : "assetNo")}
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
                      onClick={() => setCreateScanningField(createScanningField === "dbNo" ? null : "dbNo")}
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
                      setCreateScanningField(null);
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

      {/* Modal 2: Assign / Edit Borrowers & Co-borrowers Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 md:p-8 rounded-2xl max-w-lg w-full space-y-5 border border-white/20 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <span>📋</span>
                  <span>{selectedBoard ? (selectedBoard.isBorrowed ? "修改开发板借用与共用组员" : `借出登记: ${selectedBoard.dbNo}`) : "登记借出开发板"}</span>
                </h2>
                {selectedBoard && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    资产号: <span className="font-mono text-sky-400 font-bold">{selectedBoard.assetNo}</span> | DB编号: <span className="font-mono text-teal-400 font-bold">{selectedBoard.dbNo}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssignScanning(false);
                }}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {message && (
              <div className="p-3 rounded-xl bg-red-500/20 text-red-300 text-sm font-medium border border-red-500/30">
                {message}
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Camera Scanner View for Assigning Board */}
              {assignScanning && (
                <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/40 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      正在扫描开发板条形码...
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssignScanning(false)}
                      className="text-zinc-400 hover:text-white"
                    >
                      关闭摄像头
                    </button>
                  </div>
                  <CameraBarcodeScanner
                    onDetected={handleAssignCameraScan}
                    onClose={() => setAssignScanning(false)}
                  />
                </div>
              )}

              {/* Board DB / Asset No input (only if not preselected or allow changing) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-zinc-300">
                    开发板 DB 编号 或 资产号 <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAssignScanning(!assignScanning)}
                    className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>📷</span> {assignScanning ? "关闭扫码" : "扫码填入"}
                  </button>
                </div>
                <input
                  type="text"
                  value={assignDbNo}
                  onChange={e => setAssignDbNo(e.target.value)}
                  placeholder="如: DBD039A 或 24031188"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              {/* Primary Borrower Input with Live Suggestions */}
              <div className="relative">
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  主借用人学号 / 姓名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={primaryStudent}
                  onChange={e => {
                    setPrimaryStudent(e.target.value);
                    setShowPrimarySuggestions(true);
                  }}
                  onFocus={() => setShowPrimarySuggestions(true)}
                  placeholder="输入学号或姓名搜索 (如: 325010xxxx 或 张三)"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-teal-500"
                  required
                />

                {/* Suggestions Dropdown */}
                {showPrimarySuggestions && primarySuggestions.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 inset-x-0 glass rounded-xl border border-white/20 p-1.5 shadow-xl max-h-48 overflow-y-auto space-y-1">
                    {primarySuggestions.map(st => (
                      <div
                        key={st.studentId}
                        onClick={() => {
                          setPrimaryStudent(st.studentId);
                          setShowPrimarySuggestions(false);
                        }}
                        className="px-3 py-2 rounded-lg text-xs hover:bg-teal-500/20 hover:text-teal-300 cursor-pointer flex justify-between items-center transition"
                      >
                        <span className="font-bold text-zinc-100">{st.name}</span>
                        <span className="font-mono text-zinc-400">{st.studentId}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Phone Input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  借用人联系电话 (选填，用于还板催还通知)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-zinc-400 text-sm">📞</span>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="如: 13800138000"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Co-Borrowers / Team Members Section */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <span>👥</span>
                      <span>组内共用人 (Team Members)</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      同组共用一块开发板的同学，验收与系统看板将同步关联。
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                    已选 {coStudents.length} 人
                  </span>
                </div>

                {/* Selected Co-Students Badges */}
                {coStudents.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {coStudents.map((st) => (
                      <div
                        key={st.studentId}
                        className="px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs flex items-center gap-1.5 font-medium"
                      >
                        <span>{st.name || st.studentId}</span>
                        <span className="text-[10px] opacity-70 font-mono">({st.studentId})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCoStudent(st.studentId)}
                          className="text-xs opacity-70 hover:opacity-100 hover:text-red-400 transition ml-0.5"
                          title="移除该共用人"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 italic py-1">
                    暂无组内共用人（独立实验一人一块板时可留空）。
                  </p>
                )}

                {/* Add Co-Student Search Bar */}
                <div className="relative pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={coInput}
                      onChange={e => {
                        setCoInput(e.target.value);
                        setShowCoSuggestions(true);
                      }}
                      onFocus={() => setShowCoSuggestions(true)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (coSuggestions.length > 0) {
                            handleAddCoStudent(coSuggestions[0]);
                          } else if (coInput.trim()) {
                            // Find student in roster
                            const found = studentsRoster.find(
                              s => s.studentId === coInput.trim() || s.name === coInput.trim()
                            );
                            if (found) {
                              handleAddCoStudent(found);
                            } else {
                              handleAddCoStudent({ studentId: coInput.trim(), name: coInput.trim() });
                            }
                          }
                        }
                      }}
                      placeholder="输入共用同学学号或姓名，回车添加..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs font-mono focus:outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (coSuggestions.length > 0) {
                          handleAddCoStudent(coSuggestions[0]);
                        } else if (coInput.trim()) {
                          const found = studentsRoster.find(
                            s => s.studentId === coInput.trim() || s.name === coInput.trim()
                          );
                          if (found) {
                            handleAddCoStudent(found);
                          } else {
                            handleAddCoStudent({ studentId: coInput.trim(), name: coInput.trim() });
                          }
                        }
                      }}
                      disabled={!coInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-xs font-semibold transition"
                    >
                      ＋ 添加组员
                    </button>
                  </div>

                  {/* Co-student suggestions dropdown */}
                  {showCoSuggestions && coSuggestions.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 inset-x-0 glass rounded-xl border border-white/20 p-1.5 shadow-xl max-h-40 overflow-y-auto space-y-1">
                      {coSuggestions.map(st => (
                        <div
                          key={st.studentId}
                          onClick={() => handleAddCoStudent(st)}
                          className="px-3 py-1.5 rounded-lg text-xs hover:bg-teal-500/20 hover:text-teal-300 cursor-pointer flex justify-between items-center transition"
                        >
                          <span className="font-bold text-zinc-100">{st.name}</span>
                          <span className="font-mono text-zinc-400">{st.studentId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
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
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-sm font-semibold shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "保存中..." : (selectedBoard?.isBorrowed ? "保存借用与共用人信息" : "确认借出登记 (Assign)")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
