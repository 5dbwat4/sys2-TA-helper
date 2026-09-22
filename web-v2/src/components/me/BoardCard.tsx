"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import type { StudentDashboard } from "@/lib/use-student-dashboard";

export function BoardCard({ board }: { board: StudentDashboard["board"] }) {
  const t = useTranslations("me");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-950 to-brand-900 p-6 text-white"
    >
      <div className="pointer-events-none absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-brand-500/25 blur-[60px]" />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Icon icon="lucide:circuit-board" width={16} className="text-amber-400" />
          {t("myBoard")}
        </div>
        {board && !board.isReturned ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="tabular text-3xl font-bold tracking-tight">{board.dbNo}</span>
              <span className="tabular text-sm text-white/50">{board.assetNo}</span>
            </div>
            {board.teamMembers.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Icon icon="lucide:users" width={14} />
                {t("sharedWith")}: {board.teamMembers.join("、")}
              </div>
            )}
            <div className="tabular text-xs text-white/40">
              {new Date(board.assignedAt).toLocaleDateString()}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/50">{t("noBoard")}</p>
        )}
      </div>
    </motion.div>
  );
}
