"use client";

import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";

export function SettingsCard({
  icon,
  title,
  description,
  children,
  index = 0,
}: {
  icon: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-line bg-elevated p-6"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-amber-500/10 text-brand-600 dark:text-brand-300">
          <Icon icon={icon} width={19} />
        </div>
        <div>
          <h2 className="font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{description}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

export const settingsInputClass =
  "w-full rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-sm outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";
