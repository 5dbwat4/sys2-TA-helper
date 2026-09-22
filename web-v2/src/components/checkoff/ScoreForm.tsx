"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useCheckoff } from "./checkoff-store";

function ScoreSlider({
  label,
  icon,
  value,
  onChange,
  ratio,
}: {
  label: string;
  icon: string;
  value: number;
  onChange: (v: number) => void;
  ratio: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-elevated p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
          <Icon icon={icon} width={15} />
          {label}
        </span>
        <div className="flex items-center gap-3">
          <AnimatedNumber
            value={value}
            format={(v) => String(Math.round(v))}
            className="tabular text-2xl font-bold"
          />
          <span className="tabular text-xs text-fg-subtle">× {ratio}</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="score-slider mt-4 w-full"
        style={
          {
            "--fill": `${value}%`,
          } as React.CSSProperties
        }
      />
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-fg-subtle">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

export function ScoreForm({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations("checkoff");
  const { experiment, student, selectStudent } = useCheckoff();

  const [acceptance, setAcceptance] = useState(student?.submission?.acceptanceScore ?? 0);
  const [code, setCode] = useState(student?.submission?.codeScore ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAcceptance(student?.submission?.acceptanceScore ?? 0);
    setCode(student?.submission?.codeScore ?? 0);
  }, [student]);

  const finalScore = useMemo(() => {
    if (!experiment) return 0;
    return (
      Math.round(
        (acceptance * experiment.acceptanceRatio + code * experiment.codeRatio) * 10,
      ) / 10
    );
  }, [acceptance, code, experiment]);

  const contribution = useMemo(() => {
    if (!experiment) return 0;
    return Math.round((finalScore / 100) * experiment.courseWeight * 100) / 100;
  }, [finalScore, experiment]);

  const save = async () => {
    if (!experiment || !student) return;
    setSaving(true);
    try {
      const res = await fetch("/api/checkoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId: experiment.id,
          studentId: student.id,
          rawAcceptanceScore: acceptance,
          rawCodeScore: code,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        `${t("saved")} · ${student.name} — ${finalScore}`,
        { icon: <Icon icon="lucide:check-circle-2" width={16} className="text-emerald-500" /> },
      );
      selectStudent(null);
      onSaved();
    } catch {
      toast.error(t("saved") + " ✗");
    } finally {
      setSaving(false);
    }
  };

  // ⌘/Ctrl + Enter to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!experiment || !student) return null;

  return (
    <div>
      {/* student banner */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-sm font-bold text-brand-600 dark:text-brand-300">
          {student.name.slice(0, 1)}
        </div>
        <div className="flex-1">
          <span className="font-semibold">{student.name}</span>
          <span className="tabular ml-2 text-xs text-fg-muted">{student.studentId}</span>
        </div>
        <span className="text-xs text-fg-muted">
          Lab {experiment.number} · {experiment.name}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <ScoreSlider
            label={t("acceptanceScore")}
            icon="lucide:clipboard-check"
            value={acceptance}
            onChange={setAcceptance}
            ratio={experiment.acceptanceRatio}
          />
          <ScoreSlider
            label={t("codeScore")}
            icon="lucide:code-2"
            value={code}
            onChange={setCode}
            ratio={experiment.codeRatio}
          />
        </div>

        {/* live conversion panel */}
        <motion.div
          layout
          className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-950 to-brand-900 p-6 text-white"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/20 blur-[50px]" />
          <div className="relative">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/50">
              {t("finalScore")}
            </div>
            <AnimatedNumber
              value={finalScore}
              format={(v) => (Math.round(v * 10) / 10).toFixed(1)}
              className="tabular mt-2 block text-5xl font-bold tracking-tight"
            />
            <div className="tabular mt-1 text-sm text-white/60">/ 100</div>
          </div>
          <div className="relative mt-6 border-t border-white/10 pt-4">
            <div className="text-xs text-white/50">{t("courseContribution")}</div>
            <div className="tabular mt-1 text-xl font-bold text-amber-400">
              +{contribution}
              <span className="ml-1 text-xs font-medium text-white/50">/ {experiment.courseWeight}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="hidden items-center gap-1.5 text-xs text-fg-subtle sm:flex">
          <kbd className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-mono text-[10px]">⌘</kbd>
          <kbd className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
          {t("saveAndNext")}
        </span>
        <Button
          size="lg"
          fullWidth
          isPending={saving}
          onPress={save}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg shadow-emerald-600/25 sm:w-auto sm:min-w-64"
        >
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:check" width={16} />}
              {t("saveAndNext")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
