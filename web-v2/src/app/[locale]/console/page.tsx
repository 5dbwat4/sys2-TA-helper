"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "motion/react";
import { useConsoleSummary } from "@/lib/api-hooks";
import { useSession } from "@/lib/use-session";
import { StatCard, StatCardSkeleton } from "@/components/console/StatCard";
import { QuickActions } from "@/components/console/QuickActions";
import { ActivityFeed } from "@/components/console/ActivityFeed";
import { PasskeyCard } from "@/components/console/PasskeyCard";
import { ProgressRing } from "@/components/ui/ProgressRing";

export default function ConsolePage() {
  const t = useTranslations("console");
  const tc = useTranslations("checkoff");
  const { data, isLoading } = useConsoleSummary();
  const { session } = useSession();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("greetingMorning") : hour < 18 ? t("greetingAfternoon") : t("greetingEvening");

  const exp = data?.activeExperiment;
  const progress = exp && exp.totalStudents > 0 ? exp.checkedCount / exp.totalStudents : 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {greeting}，{session?.name}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t("title")} · CS-II</p>
      </motion.div>

      {/* stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {isLoading || !data ? (
          <>
            <StatCardSkeleton index={0} />
            <StatCardSkeleton index={1} />
            <StatCardSkeleton index={2} />
          </>
        ) : (
          <>
            <StatCard
              icon="lucide:clipboard-list"
              label={t("pendingCheckoff")}
              value={exp ? exp.totalStudents - exp.checkedCount : 0}
              suffix={t("students")}
              tone="brand"
              index={0}
            />
            <StatCard
              icon="lucide:circuit-board"
              label={t("unreturnedBoards")}
              value={data.unreturnedBoards}
              tone="amber"
              index={1}
            />
            <StatCard
              icon="lucide:flask-conical"
              label={t("activeExperiments")}
              value={data.experimentCount}
              tone="success"
              index={2}
            />
          </>
        )}
      </div>

      {/* current experiment progress + quick actions */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
        {exp && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={`/console/checkoff?experimentId=${exp.id}`}
              className="group flex h-full items-center gap-5 rounded-2xl border border-line bg-elevated p-6 transition-shadow hover:shadow-lg hover:shadow-brand-500/5"
            >
              <ProgressRing value={progress} size={76} stroke={7} />
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  {tc("progress")}
                </div>
                <div className="mt-1 truncate text-lg font-bold">
                  Lab {exp.number} · {exp.name}
                </div>
                <div className="tabular mt-0.5 text-sm text-fg-muted">
                  {exp.checkedCount} / {exp.totalStudents} {tc("checked")}
                </div>
              </div>
            </Link>
          </motion.div>
        )}
        <div className={exp ? "" : "lg:col-span-2"}>
          <QuickActions />
        </div>
      </div>

      {/* activity + passkey */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ActivityFeed activity={data?.activity ?? []} />
        <PasskeyCard />
      </div>
    </div>
  );
}
