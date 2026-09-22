"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";
import type { BoardsData } from "@/lib/use-boards";

type ReturnRecord = {
  dbNo: string;
  students: { name: string; studentId: string }[];
  at: Date;
};

/** Full-screen continuous-scan return mode. */
export function ReturnMode({
  students: _students,
  onExit,
  onChanged,
}: {
  students: BoardsData["students"];
  onExit: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("boards");
  const tc = useTranslations("common");
  const [input, setInput] = useState("");
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(true);

  const doReturn = async (code: string) => {
    const dbNo = code.trim();
    if (!dbNo || busy) return;
    if (records.some((r) => r.dbNo.toLowerCase() === dbNo.toLowerCase())) {
      toast.info(t("returnedSuccess") + " · " + dbNo);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/boards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbNo }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(t("notFound") + " · " + dbNo);
        return;
      }
      setRecords((prev) => [
        { dbNo: data.board.dbNo, students: data.students ?? [], at: new Date() },
        ...prev,
      ]);
      toast.success(`${t("returnedSuccess")} · ${data.board.dbNo}`);
      onChanged();
    } catch {
      toast.error(t("notFound"));
    } finally {
      setBusy(false);
      setInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{t("returnMode")}</h2>
          <p className="text-sm text-fg-muted">{t("returnHint")}</p>
        </div>
        <Button variant="ghost" onPress={onExit}>
          <Icon icon="lucide:x" width={16} />
          {tc("back")}
        </Button>
      </div>

      {/* input + scanner toggle */}
      <div className="flex gap-2">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            doReturn(input);
          }}
        >
          <Icon
            icon="lucide:barcode"
            width={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            placeholder="DB-001"
            className="tabular w-full rounded-2xl border border-line bg-elevated py-3.5 pl-11 pr-12 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15"
          />
          {busy && <Spinner size="sm" className="absolute right-4 top-1/2 -translate-y-1/2" />}
        </form>
        <Button variant="secondary" size="lg" onPress={() => setScanning((v) => !v)}>
          <Icon icon={scanning ? "lucide:video-off" : "lucide:video"} width={18} />
        </Button>
      </div>

      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 overflow-hidden rounded-2xl"
          >
            <CameraBarcodeScanner isContinuous onDetected={doReturn} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* returned records fly-in list */}
      <div className="mt-5 space-y-2">
        <AnimatePresence mode="popLayout">
          {records.map((r) => (
            <motion.div
              key={r.dbNo + r.at.getTime()}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Icon icon="lucide:check" width={15} />
              </span>
              <div className="flex-1">
                <span className="tabular font-semibold">{r.dbNo}</span>
                <span className="ml-2 text-xs text-fg-muted">
                  {r.students.map((s) => s.name).join("、")}
                </span>
              </div>
              <span className="tabular text-xs text-fg-subtle">
                {r.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
