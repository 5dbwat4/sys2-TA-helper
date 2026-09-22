"use client";

import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Skeleton } from "@heroui/react";

export function StatCard({
  icon,
  label,
  value,
  suffix,
  tone = "brand",
  index = 0,
}: {
  icon: string;
  label: string;
  value: number;
  suffix?: string;
  tone?: "brand" | "amber" | "success";
  index?: number;
}) {
  const tones = {
    brand: "from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-300",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
    success: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-line bg-elevated p-5 transition-shadow hover:shadow-lg hover:shadow-brand-500/5"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 ${tones[tone]}`}
        style={{ maskImage: "linear-gradient(135deg, black 0%, transparent 60%)" }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{label}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <AnimatedNumber value={value} className="tabular text-3xl font-bold tracking-tight" format={(v) => String(Math.round(v))} />
            {suffix && <span className="text-sm text-fg-muted">{suffix}</span>}
          </div>
        </div>
        <div className={`rounded-xl bg-gradient-to-br p-2.5 ${tones[tone]}`}>
          <Icon icon={icon} width={20} />
        </div>
      </div>
    </motion.div>
  );
}

export function StatCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl border border-line bg-elevated p-5"
    >
      <Skeleton className="h-3 w-24 rounded" />
      <Skeleton className="mt-3 h-8 w-16 rounded" />
    </motion.div>
  );
}
