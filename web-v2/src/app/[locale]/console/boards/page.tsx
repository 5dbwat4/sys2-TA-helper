"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Button, Skeleton } from "@heroui/react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { useBoards, type Board } from "@/lib/use-boards";
import { BoardGrid } from "@/components/boards/BoardGrid";
import { ReturnMode } from "@/components/boards/ReturnMode";
import { LendModal } from "@/components/boards/LendModal";

export default function BoardsPage() {
  const t = useTranslations("boards");
  const { data, isLoading, mutate } = useBoards();
  const [mode, setMode] = useState<"manage" | "return">("manage");
  const [lendTarget, setLendTarget] = useState<Board | null>(null);

  const quickReturn = async (b: Board) => {
    const res = await fetch("/api/boards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dbNo: b.dbNo }),
    });
    if (res.ok) {
      toast.success(`${t("returnedSuccess")} · ${b.dbNo}`);
      mutate();
    } else {
      toast.error(t("notFound"));
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
          {data && (
            <p className="tabular mt-1 text-sm text-fg-muted">
              {data.boards.filter((b) => b.isBorrowed).length} / {data.boards.length} {t("statusBorrowed")}
            </p>
          )}
        </div>
        {mode === "manage" && (
          <Button
            size="lg"
            onPress={() => setMode("return")}
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg shadow-emerald-600/25"
          >
            <Icon icon="lucide:scan-barcode" width={18} />
            <span className="hidden sm:inline">{t("returnMode")}</span>
          </Button>
        )}
      </motion.div>

      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {mode === "return" ? (
            <ReturnMode
              key="return"
              students={data.students}
              onExit={() => setMode("manage")}
              onChanged={() => mutate()}
            />
          ) : (
            <motion.div
              key="manage"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <BoardGrid boards={data.boards} onLend={setLendTarget} onReturn={quickReturn} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {lendTarget && (
          <LendModal
            board={lendTarget}
            students={data?.students ?? []}
            onClose={() => setLendTarget(null)}
            onDone={() => mutate()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
