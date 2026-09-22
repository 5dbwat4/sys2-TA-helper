"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Chip } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import type { StudentDashboard } from "@/lib/use-student-dashboard";
import { cn } from "@/lib/utils";

function GradeTimelineItem({
  grade,
  index,
}: {
  grade: StudentDashboard["grades"][number];
  index: number;
}) {
  const t = useTranslations("me");
  const sub = grade.submission;
  const graded = grade.status === "GRADED" && sub?.finalScore !== null && sub?.finalScore !== undefined;

  return (
    <motion.li
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      {/* timeline spine */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            graded
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : grade.status === "PENDING"
                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-line bg-sunken text-fg-subtle",
          )}
        >
          <Icon
            icon={graded ? "lucide:check" : grade.status === "PENDING" ? "lucide:clock" : "lucide:circle-dashed"}
            width={15}
          />
        </div>
        <div className="mt-1 w-px flex-1 bg-line last:hidden" />
      </div>

      <div className="flex-1 rounded-2xl border border-line bg-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="tabular text-xs font-bold uppercase tracking-widest text-fg-subtle">
                Lab {grade.experimentNumber}
              </span>
              {sub?.checkpointClaimed && (
                <Chip size="sm" color="accent" variant="soft">
                  {t("checkpoint")}
                </Chip>
              )}
              {sub?.isPlagiarised && (
                <Chip size="sm" color="danger" variant="soft">
                  <Icon icon="lucide:alert-triangle" width={11} />
                </Chip>
              )}
            </div>
            <h4 className="mt-1 text-sm font-bold">{grade.experimentName}</h4>
          </div>
          <div className="text-right">
            {graded ? (
              <>
                <AnimatedNumber
                  value={sub.finalScore!}
                  format={(v) => (Math.round(v * 10) / 10).toFixed(1)}
                  className="tabular text-xl font-bold"
                />
                <div className="tabular text-[10px] text-fg-subtle">
                  +{grade.courseScore?.toFixed(2)} / {grade.courseWeight}
                </div>
              </>
            ) : (
              <span className="text-xs text-fg-subtle">
                {grade.status === "PENDING" ? t("statusPending") : t("statusNotStarted")}
              </span>
            )}
          </div>
        </div>

        {sub && (
          <div className="tabular mt-3 flex gap-4 border-t border-line pt-3 text-xs text-fg-muted">
            <span title="验收">A {sub.acceptanceScore ?? "—"}</span>
            <span title="报告">R {sub.reportScore ?? "—"}</span>
            <span title="代码">C {sub.codeScore ?? "—"}</span>
            {sub.remark && <span className="truncate text-fg-subtle">{sub.remark}</span>}
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function GradeTimeline({ grades }: { grades: StudentDashboard["grades"] }) {
  const t = useTranslations("me");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-line bg-elevated p-6"
    >
      <h3 className="mb-5 flex items-center gap-2 text-sm font-bold">
        <Icon icon="lucide:list-checks" width={16} className="text-fg-muted" />
        {t("myGrades")}
      </h3>
      {grades.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-subtle">{t("noGrades")}</p>
      ) : (
        <ul>
          {grades.map((g, i) => (
            <GradeTimelineItem key={g.experimentId} grade={g} index={i} />
          ))}
        </ul>
      )}
    </motion.div>
  );
}
