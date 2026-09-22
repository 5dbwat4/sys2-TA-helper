"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Button, Chip, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import type { Board, BoardsData } from "@/lib/use-boards";

const inputClass =
  "w-full rounded-xl border border-line bg-elevated px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function LendModal({
  board,
  students,
  onClose,
  onDone,
}: {
  board: Board | null;
  students: BoardsData["students"];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("boards");
  const tc = useTranslations("common");
  const [borrower, setBorrower] = useState("");
  const [coBorrower, setCoBorrower] = useState("");
  const [phone, setPhone] = useState(board?.contactPhone ?? "");
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    const q = borrower.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter(
        (s) =>
          s.studentId.toLowerCase().includes(q) ||
          s.studentId.endsWith(q) ||
          s.name.includes(borrower.trim()),
      )
      .slice(0, 5);
  }, [borrower, students]);

  if (!board) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbNo: board.dbNo,
          studentId: borrower.trim(),
          coStudents: coBorrower.trim() || undefined,
          contactPhone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.missing ? `${data.missing.join(", ")}` : tc("error"));
        return;
      }
      toast.success(`${t("lend")} · ${board.dbNo}`);
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
        className="glass w-full max-w-md rounded-3xl p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{t("lend")}</h3>
            <p className="tabular text-sm text-fg-muted">
              {board.dbNo} · {board.assetNo}
            </p>
          </div>
          <Button isIconOnly variant="ghost" size="sm" onPress={onClose} aria-label={tc("close")}>
            <Icon icon="lucide:x" width={16} />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("borrower")}</label>
            <input
              className={inputClass}
              value={borrower}
              onChange={(e) => setBorrower(e.target.value)}
              placeholder={tc("search")}
              autoFocus
              required
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-elevated shadow-xl">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBorrower(s.studentId)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-sunken"
                  >
                    <span className="tabular text-fg-muted">{s.studentId}</span>
                    <span className="font-medium">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("coBorrower")}</label>
            <input
              className={inputClass}
              value={coBorrower}
              onChange={(e) => setCoBorrower(e.target.value)}
              placeholder="3240100001, 3240100002"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("phone")}</label>
            <input
              className={inputClass + " tabular"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="138xxxxxxxx"
            />
          </div>

          <Button type="submit" fullWidth size="lg" isPending={saving} className="bg-gradient-to-r from-brand-600 to-brand-700">
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:check" width={16} />}
                {tc("confirm")}
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </motion.div>
  );
}

export function ChipLabel({ children }: { children: React.ReactNode }) {
  return <Chip size="sm" variant="soft">{children}</Chip>;
}
