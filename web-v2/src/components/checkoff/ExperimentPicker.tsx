"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Chip } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import type { Experiment } from "./checkoff-store";

export function ExperimentPicker({
  experiments,
  onSelect,
}: {
  experiments: Experiment[];
  onSelect: (e: Experiment) => void;
}) {
  const t = useTranslations("checkoff");

  if (experiments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="rounded-2xl bg-sunken p-4">
          <Icon icon="lucide:flask-conical" width={28} className="text-fg-subtle" />
        </div>
        <p className="text-sm text-fg-muted">{t("noExperiment")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {experiments.map((exp, i) => (
        <motion.button
          key={exp.id}
          type="button"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(exp)}
          className="group relative overflow-hidden rounded-2xl border border-line bg-elevated p-5 text-left transition-shadow hover:shadow-xl hover:shadow-brand-500/8"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-brand-500/15 to-amber-500/10 blur-2xl transition-opacity opacity-0 group-hover:opacity-100" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="tabular text-xs font-bold uppercase tracking-widest text-fg-subtle">
                Lab {exp.number}
              </span>
              <Chip size="sm" color={exp.isPublished ? "success" : "default"} variant="soft">
                {exp.isPublished ? "●" : "○"}
              </Chip>
            </div>
            <h3 className="mt-2 text-base font-bold leading-snug">{exp.name}</h3>
            <div className="mt-3 flex items-center gap-3 text-xs text-fg-muted">
              <span className="flex items-center gap-1">
                <Icon icon="lucide:help-circle" width={13} />
                {exp.questions.length}
              </span>
              <span className="tabular flex items-center gap-1">
                <Icon icon="lucide:percent" width={13} />
                {exp.courseWeight}
              </span>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
