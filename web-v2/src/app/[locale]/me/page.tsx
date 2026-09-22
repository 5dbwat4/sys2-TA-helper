"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Skeleton } from "@heroui/react";
import { useStudentDashboard } from "@/lib/use-student-dashboard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { BoardCard } from "@/components/me/BoardCard";
import { GradeTimeline } from "@/components/me/GradeTimeline";

export default function MePage() {
  const t = useTranslations("me");
  const { data, isLoading } = useStudentDashboard();

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const { totalEarned, maxPossible } = data.courseSummary;
  const progress = maxPossible > 0 ? totalEarned / maxPossible : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{data.student.name}</h1>
        <p className="tabular mt-1 text-sm text-fg-muted">{data.student.studentId}</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <BoardCard board={data.board} />

        {/* total course progress */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-6 rounded-2xl border border-line bg-elevated p-6"
        >
          <ProgressRing value={progress} size={88} stroke={8} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              {t("totalEarned")}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <AnimatedNumber
                value={totalEarned}
                format={(v) => (Math.round(v * 100) / 100).toFixed(2)}
                className="tabular text-3xl font-bold tracking-tight"
              />
              <span className="tabular text-sm text-fg-muted">/ {maxPossible.toFixed(1)}</span>
            </div>
            <div className="tabular mt-1 text-xs text-fg-subtle">
              {data.grades.filter((g) => g.status === "GRADED").length} / {data.grades.length} Labs
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-4">
        <GradeTimeline grades={data.grades} />
      </div>
    </div>
  );
}
