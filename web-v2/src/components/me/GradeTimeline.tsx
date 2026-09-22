"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Chip } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import type { StudentDashboard, TimelineItem } from "@/lib/use-student-dashboard";
import { cn } from "@/lib/utils";

function QuizTimelineItem({ item, index }: { item: Extract<TimelineItem, { itemType: "QUIZ" }>; index: number }) {
  const graded = item.status === "GRADED" && item.score !== null;

  return (
    <motion.li
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            graded
              ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400"
              : "border-line bg-sunken text-fg-subtle",
          )}
        >
          <Icon icon={graded ? "lucide:check" : "lucide:help-circle"} width={15} />
        </div>
        <div className="mt-1 w-px flex-1 bg-line last:hidden" />
      </div>

      <div className="flex-1 rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-4 transition-colors hover:border-purple-500/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Chip size="sm" color="accent" variant="soft" className="text-[11px] font-bold">
                随堂小测
              </Chip>
              <span className="tabular text-xs text-fg-subtle">
                {new Date(item.publishDate).toLocaleDateString()}
              </span>
            </div>
            <h4 className="mt-1 text-sm font-bold text-fg">{item.name}</h4>
          </div>
          <div className="text-right">
            {graded ? (
              <>
                <AnimatedNumber
                  value={item.score!}
                  format={(v) => (Math.round(v * 10) / 10).toFixed(1)}
                  className="tabular text-xl font-bold text-purple-600 dark:text-purple-400"
                />
                <div className="tabular text-[10px] text-fg-subtle">
                  +{item.courseScore?.toFixed(2)} / {item.courseWeight}
                </div>
              </>
            ) : (
              <span className="text-xs text-fg-subtle">暂无成绩</span>
            )}
          </div>
        </div>

        <div className="tabular mt-3 flex flex-wrap gap-4 border-t border-line/60 pt-3 text-xs text-fg-muted">
          <span>满分 {item.totalScore} 分</span>
          <span>总评权重 {item.courseWeight} 分</span>
          {item.remark && <span className="truncate text-fg-subtle">备注: {item.remark}</span>}
        </div>
      </div>
    </motion.li>
  );
}

function ExperimentTimelineItem({
  item,
  index,
}: {
  item: Extract<TimelineItem, { itemType: "EXPERIMENT" }>;
  index: number;
}) {
  const t = useTranslations("me");
  const sub = item.submission;
  const isUnpub = !item.isPublished;
  const graded = !isUnpub && item.status === "GRADED" && sub?.finalScore !== null && sub?.finalScore !== undefined;

  if (isUnpub) {
    return (
      <motion.li
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.15 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex gap-4 pb-6 opacity-75 last:pb-0"
      >
        <div className="flex flex-col items-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-line bg-sunken text-fg-subtle">
            <Icon icon="lucide:lock" width={14} />
          </div>
          <div className="mt-1 w-px flex-1 bg-line last:hidden" />
        </div>

        <div className="flex-1 rounded-2xl border border-dashed border-line bg-sunken/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="tabular text-xs font-bold uppercase tracking-widest text-fg-subtle">
                  Lab {item.experimentNumber}
                </span>
                <Chip size="sm" variant="soft" className="text-[11px] text-fg-subtle">
                  未发布
                </Chip>
                <Chip size="sm" variant="soft" className="text-[11px] text-fg-subtle">
                  {item.type === "HARDWARE" ? "硬件实验" : item.type === "SOFTWARE" ? "软件实验" : "综合实验"}
                </Chip>
              </div>
              <h4 className="mt-1 text-sm font-semibold text-fg-subtle">（实验内容尚未公开）</h4>
            </div>
            <div className="text-right">
              <div className="tabular text-xl font-bold text-fg-subtle">0.0</div>
              <div className="tabular text-[10px] text-fg-subtle">0.00 / {item.courseWeight}</div>
            </div>
          </div>

          <div className="tabular mt-3 flex flex-wrap gap-4 border-t border-line/50 pt-3 text-xs text-fg-subtle">
            <span>预计发布: {new Date(item.publishDate).toLocaleDateString()}</span>
            <span>
              权重: 验收({Math.round(item.acceptanceRatio * 100)}%) / 报告({Math.round(item.reportRatio * 100)}%) / 代码({Math.round(item.codeRatio * 100)}%)
            </span>
            <span>总评占比: {item.courseWeight} 分</span>
          </div>
        </div>
      </motion.li>
    );
  }

  return (
    <motion.li
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            graded
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : item.status === "PENDING"
                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-line bg-sunken text-fg-subtle",
          )}
        >
          <Icon
            icon={graded ? "lucide:check" : item.status === "PENDING" ? "lucide:clock" : "lucide:circle-dashed"}
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
                Lab {item.experimentNumber}
              </span>
              <Chip size="sm" variant="soft" className="text-[11px] text-fg-muted">
                {item.type === "HARDWARE" ? "硬件实验" : item.type === "SOFTWARE" ? "软件实验" : "综合实验"}
              </Chip>
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
            <h4 className="mt-1 text-sm font-bold">{item.experimentName}</h4>
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
                  +{item.courseScore?.toFixed(2)} / {item.courseWeight}
                </div>
              </>
            ) : (
              <span className="text-xs text-fg-subtle">
                {item.status === "PENDING" ? t("statusPending") : t("statusNotStarted")}
              </span>
            )}
          </div>
        </div>

        {sub && (
          <div className="tabular mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-xs text-fg-muted">
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

export function GradeTimeline({ items }: { items: StudentDashboard["timelineItems"] }) {
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
      {!items || items.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-subtle">{t("noGrades")}</p>
      ) : (
        <ul>
          {items.map((item, i) =>
            item.itemType === "QUIZ" ? (
              <QuizTimelineItem key={`quiz-${item.id}`} item={item} index={i} />
            ) : (
              <ExperimentTimelineItem key={`exp-${item.experimentId}`} item={item} index={i} />
            ),
          )}
        </ul>
      )}
    </motion.div>
  );
}
