"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Chip } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import type { Board } from "@/lib/use-boards";
import { cn } from "@/lib/utils";

export function BoardGrid({
  boards,
  onLend,
  onReturn,
}: {
  boards: Board[];
  onLend: (b: Board) => void;
  onReturn: (b: Board) => void;
}) {
  const t = useTranslations("boards");
  const [filter, setFilter] = useState<"all" | "borrowed" | "available">("all");

  const filtered = boards.filter((b) =>
    filter === "all" ? true : filter === "borrowed" ? b.isBorrowed : !b.isBorrowed,
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["all", "borrowed", "available"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "relative rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === f ? "text-white" : "text-fg-muted hover:bg-sunken",
            )}
          >
            {filter === f && (
              <motion.span
                layoutId="board-filter"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative">
              {f === "all" ? t("status") : f === "borrowed" ? t("statusBorrowed") : t("statusAvailable")}
            </span>
          </button>
        ))}
        <span className="tabular ml-auto self-center text-xs text-fg-subtle">
          {filtered.length} / {boards.length}
        </span>
      </div>

      <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((b, i) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-elevated p-4 transition-shadow hover:shadow-lg",
                b.isBorrowed
                  ? "border-amber-500/30 hover:shadow-amber-500/5"
                  : "border-line hover:shadow-brand-500/5",
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl",
                  b.isBorrowed ? "bg-amber-500/15" : "bg-emerald-500/10",
                )}
              />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="tabular text-lg font-bold tracking-tight">{b.dbNo}</div>
                    <div className="tabular text-xs text-fg-subtle">{b.assetNo}</div>
                  </div>
                  <Chip size="sm" color={b.isBorrowed ? "warning" : "success"} variant="soft">
                    {b.isBorrowed ? t("statusBorrowed") : t("statusAvailable")}
                  </Chip>
                </div>

                {b.isBorrowed && b.currentStudent && (
                  <div className="mt-3 space-y-1 text-xs text-fg-muted">
                    <div className="flex items-center gap-1.5">
                      <Icon icon="lucide:user" width={12} />
                      {b.allBorrowers.map((s) => s.name).join("、")}
                    </div>
                    {b.contactPhone && (
                      <div className="tabular flex items-center gap-1.5">
                        <Icon icon="lucide:phone" width={12} />
                        {b.contactPhone}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {b.isBorrowed ? (
                    <button
                      type="button"
                      onClick={() => onReturn(b)}
                      className="flex-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                    >
                      {t("return")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onLend(b)}
                      className="flex-1 rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-500/20 dark:text-brand-300"
                    >
                      {t("lend")}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
