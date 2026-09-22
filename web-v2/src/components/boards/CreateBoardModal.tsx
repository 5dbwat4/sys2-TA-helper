"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";

const inputClass =
  "w-full rounded-xl border border-line bg-elevated px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function CreateBoardModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("boards");
  const tc = useTranslations("common");
  const [tab, setTab] = useState<"single" | "batch">("single");
  const [assetNo, setAssetNo] = useState("");
  const [dbNo, setDbNo] = useState("");
  const [phone, setPhone] = useState("");
  const [keepAdding, setKeepAdding] = useState(true);
  const [batchText, setBatchText] = useState("");
  const [saving, setSaving] = useState(false);

  const submitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetNo.trim() || !dbNo.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          assetNo: assetNo.trim(),
          dbNo: dbNo.trim(),
          contactPhone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error === "BOARD_EXISTS" ? "开发板编号或资产号已存在" : tc("error"));
        return;
      }
      toast.success(`成功录入: ${data.board.dbNo}`);
      onDone();
      if (keepAdding) {
        setAssetNo("");
        setDbNo("");
        setPhone("");
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const submitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = batchText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const boards = lines.map((line) => {
      const parts = line.split(/[,\t\s]+/).filter(Boolean);
      return {
        assetNo: parts[0] || "",
        dbNo: parts[1] || "",
        contactPhone: parts[2] || undefined,
      };
    });

    setSaving(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_create",
          boards,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(tc("error"));
        return;
      }
      toast.success(`批量录入完成，成功导入 ${data.createdCount} 块板`);
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-lg rounded-3xl p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">录入新开发板</h3>
            <p className="text-sm text-fg-muted">添加采购或入库的硬件板卡</p>
          </div>
          <Button isIconOnly variant="ghost" size="sm" onPress={onClose} aria-label={tc("close")}>
            <Icon icon="lucide:x" width={16} />
          </Button>
        </div>

        {/* Tab switch */}
        <div className="mb-4 flex rounded-xl border border-line bg-sunken p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("single")}
            className={`flex-1 rounded-lg py-1.5 transition-all ${
              tab === "single" ? "bg-elevated text-fg shadow-sm" : "text-fg-subtle hover:text-fg"
            }`}
          >
            单个录入
          </button>
          <button
            type="button"
            onClick={() => setTab("batch")}
            className={`flex-1 rounded-lg py-1.5 transition-all ${
              tab === "batch" ? "bg-elevated text-fg shadow-sm" : "text-fg-subtle hover:text-fg"
            }`}
          >
            批量导入 (Batch)
          </button>
        </div>

        {tab === "single" ? (
          <form onSubmit={submitSingle} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-fg-muted">
                资产编号 (Asset No) <span className="text-danger">*</span>
              </label>
              <input
                className={inputClass + " font-mono"}
                value={assetNo}
                onChange={(e) => setAssetNo(e.target.value)}
                placeholder="如: 2403248A"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-fg-muted">
                DB 编号 (DB No) <span className="text-danger">*</span>
              </label>
              <input
                className={inputClass + " font-mono"}
                value={dbNo}
                onChange={(e) => setDbNo(e.target.value)}
                placeholder="如: DB040A"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-fg-muted">
                联系电话 / 存放备注 (选填)
              </label>
              <input
                className={inputClass + " font-mono"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="选填"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="keepAddingBoard"
                checked={keepAdding}
                onChange={(e) => setKeepAdding(e.target.checked)}
                className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="keepAddingBoard" className="cursor-pointer select-none text-xs text-fg-muted">
                保存后继续录入下一块（适合拆箱入库）
              </label>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              isPending={saving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg"
            >
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:plus" width={16} />}
                  确认录入 (Save Board)
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitBatch} className="space-y-4">
            <div className="rounded-xl border border-line bg-sunken p-3 text-xs text-fg-muted">
              <p className="font-semibold text-fg">每行格式：</p>
              <p className="mt-0.5 font-mono">资产编号, DB编号, 备注电话(选填)</p>
            </div>

            <div>
              <textarea
                rows={5}
                className={inputClass + " font-mono text-xs"}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={`2403248A, DB040A\n2403249A, DB041A\n2403250A, DB042A`}
                required
              />
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              isPending={saving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg"
            >
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:check" width={16} />}
                  开始批量录入
                </>
              )}
            </Button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
