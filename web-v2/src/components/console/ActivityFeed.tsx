"use client";

import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import type { ConsoleSummary } from "@/lib/api-hooks";

const KIND_META = {
  checkoff: { icon: "lucide:clipboard-check", color: "text-brand-500 bg-brand-500/10" },
  lend: { icon: "lucide:arrow-up-right", color: "text-amber-500 bg-amber-500/10" },
  return: { icon: "lucide:arrow-down-left", color: "text-emerald-500 bg-emerald-500/10" },
} as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function ActivityFeed({ activity }: { activity: ConsoleSummary["activity"] }) {
  const t = useTranslations("console");
  const tc = useTranslations("common");

  return (
    <div className="rounded-2xl border border-line bg-elevated p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
        <Icon icon="lucide:activity" width={16} className="text-fg-muted" />
        {t("recentActivity")}
      </h3>
      {activity.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-subtle">{tc("noData")}</p>
      ) : (
        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {activity.map((item, i) => {
              const meta = KIND_META[item.kind];
              return (
                <motion.li
                  key={`${item.at}-${i}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sunken"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.color}`}>
                    <Icon icon={meta.icon} width={14} />
                  </span>
                  <span className="flex-1 truncate text-sm text-fg-muted">{item.text}</span>
                  <span className="tabular text-xs text-fg-subtle">{timeAgo(item.at)}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
