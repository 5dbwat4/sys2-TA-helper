"use client";

import { useEffect, useState, useRef } from "react";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

export default function BoardReturnPage() {
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [manualCode, setManualCode] = useState("");

  // Session state
  const [sessionReturned, setSessionReturned] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [processing, setProcessing] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<"HISTORY" | "UNRETURNED">("HISTORY");

  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchBoards = async () => {
    try {
      const res = await fetch("/api/boards");
      const data = await res.json();
      if (data.success) {
        setBoards(data.boards);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const unreturnedList = boards.filter((b) => b.isBorrowed);
  const remainingCount = unreturnedList.length;

  // Process a scanned or typed barcode
  const handleProcessCode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || processing) return;

    setProcessing(true);
    setStatusMessage({ text: `正在登记开发板条码 [${code}]...`, type: "info" });

    try {
      const resp = await fetch("/api/boards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbNo: code }),
      });

      const data = await resp.json();

      if (resp.ok && data.success) {
        const entry = {
          board: data.board,
          students: data.students,
          returnedAt: new Date().toLocaleTimeString(),
        };

        setSessionReturned((prev) => [entry, ...prev]);
        setStatusMessage({
          text: `✓ 成功归还！开发板: ${data.board.dbNo} (${data.board.assetNo})，借用同学: ${data.students.map((s: any) => `${s.name} (${s.studentId})`).join(", ")}`,
          type: "success",
        });

        // Refresh boards data
        fetchBoards();
      } else {
        setStatusMessage({
          text: `❌ 归还失败: ${data.error || "开发板不存在或未借出"}`,
          type: "error",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `❌ 网络异常: ${err.message}`,
        type: "error",
      });
    } finally {
      setProcessing(false);
      setManualCode("");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleProcessCode(manualCode);
  };

  // Copy unreturned list to clipboard
  const handleCopyUnreturned = () => {
    const header = "学号\t姓名\tDB编号\t资产编号\t联系电话\n";
    const body = unreturnedList
      .map(
        (b) =>
          `${b.currentStudent?.studentId || "-"}\t${b.currentStudent?.name || "-"}\t${b.dbNo}\t${b.assetNo}\t${b.contactPhone || "-"}`
      )
      .join("\n");
    navigator.clipboard.writeText(header + body);
    alert(`已将 ${unreturnedList.length} 条未还名单复制到剪贴板！`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <a
              href="/boards"
              className="text-xs text-sky-400 hover:text-sky-300 transition flex items-center gap-1"
            >
              ← 返回实验板列表
            </a>
            <span className="text-zinc-500">/</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              连续扫码归还
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">
            开发板归还登记 (Return Boards)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            使用手机摄像头或条形码扫描枪连续扫描板上 DB 号 / 资产号条形码，系统将自动核销并实时更新剩余未还名单。
          </p>
        </div>

        {/* Counter Widget */}
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[100px]">
            <span className="text-xs text-zinc-400 block font-medium">本次归还</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {sessionReturned.length}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center min-w-[110px]">
            <span className="text-xs text-amber-300 block font-medium">剩余未还</span>
            <span className="text-2xl font-bold font-mono text-amber-300">
              {loading ? "..." : remainingCount}
            </span>
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-3 transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
              : statusMessage.type === "error"
              ? "bg-rose-500/20 border-rose-500/40 text-rose-200"
              : "bg-blue-500/20 border-blue-500/40 text-blue-200"
          }`}
        >
          <span className="text-lg">
            {statusMessage.type === "success" ? "✓" : statusMessage.type === "error" ? "⚠️" : "⏳"}
          </span>
          <span className="flex-1">{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Continuous Scanner & Manual Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Scanner (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass p-5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold flex items-center gap-2 text-zinc-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                手机/电脑系统摄像头连续扫描
              </h2>
              <button
                onClick={() => setCameraActive(!cameraActive)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                  cameraActive
                    ? "bg-white/10 hover:bg-white/20 text-zinc-300 border-white/20"
                    : "bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border-emerald-500/30"
                }`}
              >
                {cameraActive ? "暂停摄像头" : "开启摄像头"}
              </button>
            </div>

            {cameraActive ? (
              <CameraBarcodeScanner
                onDetected={handleProcessCode}
                isContinuous={true}
              />
            ) : (
              <div className="aspect-[4/3] rounded-2xl bg-black/40 border border-white/10 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
                <span className="text-4xl mb-2">📷</span>
                <p className="text-sm">摄像头已暂停</p>
                <button
                  onClick={() => setCameraActive(true)}
                  className="mt-3 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition border border-emerald-500/30"
                >
                  点击开启连续扫描
                </button>
              </div>
            )}

            <p className="text-[11px] text-zinc-400 text-center">
              适配 iOS Safari 及 macOS Safari。将开发板 DB 号或资产编号条形码置于框内即可自动核销。
            </p>
          </div>
        </div>

        {/* Right Column: Physical Scanner / Manual Input & Tabs (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Manual Input for Barcode Gun */}
          <div className="glass p-5 rounded-2xl space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <span>🔫</span>
              <span>扫码枪 / 手动输入</span>
            </h3>

            <form onSubmit={handleManualSubmit} className="space-y-2">
              <input
                ref={inputRef}
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="使用外接扫码枪扫码，或输入 DB号 / 资产号..."
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/20 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 font-mono"
              />
              <button
                type="submit"
                disabled={processing || !manualCode.trim()}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-sm disabled:opacity-50"
              >
                {processing ? "登记中..." : "确认核销"}
              </button>
            </form>
          </div>

          {/* Record List Switcher */}
          <div className="glass p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("HISTORY")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "HISTORY"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  本次已还 ({sessionReturned.length})
                </button>
                <button
                  onClick={() => setActiveTab("UNRETURNED")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "UNRETURNED"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  未还名单 ({remainingCount})
                </button>
              </div>

              {activeTab === "UNRETURNED" && (
                <button
                  onClick={handleCopyUnreturned}
                  className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] text-zinc-300 transition"
                  title="复制未还名单到剪贴板"
                >
                  📋 复制名单
                </button>
              )}
            </div>

            {/* List Body */}
            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
              {activeTab === "HISTORY" ? (
                sessionReturned.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">
                    本次会话暂无归还记录。开启摄像头或使用扫码枪扫描即可开始。
                  </p>
                ) : (
                  sessionReturned.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-300 font-mono">
                          {item.board.dbNo}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {item.returnedAt}
                        </span>
                      </div>
                      <div className="text-zinc-300 flex justify-between">
                        <span>资产号: {item.board.assetNo}</span>
                        <span>
                          {item.students.map((s: any) => s.name).join(", ")}
                        </span>
                      </div>
                    </div>
                  ))
                )
              ) : unreturnedList.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <span className="text-3xl">🎉</span>
                  <p className="text-xs font-bold text-emerald-300">
                    太棒了！所有开发板已全部归还！
                  </p>
                </div>
              ) : (
                unreturnedList.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1 hover:border-amber-500/30 transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-300 font-mono">
                        {b.dbNo}
                      </span>
                      <span className="text-zinc-400 font-mono">{b.assetNo}</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>
                        借用: <strong>{b.currentStudent?.name || "未知"}</strong> ({b.currentStudent?.studentId || "-"})
                      </span>
                      {b.contactPhone && (
                        <a
                          href={`tel:${b.contactPhone}`}
                          className="text-sky-400 hover:underline"
                        >
                          📞 {b.contactPhone}
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
