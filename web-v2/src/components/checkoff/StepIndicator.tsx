"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { useCheckoff, type Step } from "./checkoff-store";

const STEP_META: { key: string; icon: string }[] = [
  { key: "stepExperiment", icon: "lucide:flask-conical" },
  { key: "stepStudent", icon: "lucide:user-search" },
  { key: "stepQuestions", icon: "lucide:help-circle" },
  { key: "stepScore", icon: "lucide:pen-line" },
];

export function StepIndicator() {
  const t = useTranslations("checkoff");
  const { step, setStep, experiment, student } = useCheckoff();

  const canGo = (target: Step) => {
    if (target === 0) return true;
    if (target === 1) return Boolean(experiment);
    if (target >= 2) return Boolean(experiment && student);
    return false;
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-elevated p-1.5 sm:gap-2">
      {STEP_META.map((meta, i) => {
        const active = step === i;
        const done = step > i;
        const allowed = canGo(i as Step);
        return (
          <button
            key={meta.key}
            type="button"
            disabled={!allowed}
            onClick={() => setStep(i as Step)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
              active
                ? "text-white"
                : done
                  ? "text-brand-600 hover:bg-brand-500/10 dark:text-brand-300"
                  : allowed
                    ? "text-fg-muted hover:bg-sunken"
                    : "cursor-not-allowed text-fg-subtle/50",
            )}
          >
            {active && (
              <motion.span
                layoutId="step-pill"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/25"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <Icon
              icon={done && !active ? "lucide:check" : meta.icon}
              width={15}
              className="relative"
            />
            <span className="relative hidden sm:inline">{t(meta.key)}</span>
          </button>
        );
      })}
    </div>
  );
}
