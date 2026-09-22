"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { useCheckoff } from "./checkoff-store";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Mark = "correct" | "partial" | "wrong";

const MARK_META: Record<Mark, { icon: string; className: string; activeClass: string }> = {
  correct: {
    icon: "lucide:check",
    className: "border-line text-fg-muted hover:border-emerald-500/50 hover:text-emerald-500",
    activeClass: "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  partial: {
    icon: "lucide:minus",
    className: "border-line text-fg-muted hover:border-amber-500/50 hover:text-amber-500",
    activeClass: "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  wrong: {
    icon: "lucide:x",
    className: "border-line text-fg-muted hover:border-red-500/50 hover:text-red-500",
    activeClass: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

export function QuestionDrawer({ onNext }: { onNext: () => void }) {
  const t = useTranslations("checkoff");
  const {
    experiment,
    student,
    drawnQuestions,
    setDrawnQuestions,
    questionMarks,
    markQuestion,
  } = useCheckoff();
  const [drawing, setDrawing] = useState(false);

  const draw = () => {
    if (!experiment || experiment.questions.length === 0) return;
    setDrawing(true);
    // Slot-machine style: brief suspense then reveal
    setTimeout(() => {
      const count = Math.min(3, experiment.questions.length);
      setDrawnQuestions(shuffle(experiment.questions).slice(0, count));
      setDrawing(false);
    }, 650);
  };

  const marks: Mark[] = ["correct", "partial", "wrong"];

  return (
    <div>
      {/* student banner */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-sm font-bold text-brand-600 dark:text-brand-300">
          {student?.name.slice(0, 1)}
        </div>
        <div className="flex-1">
          <span className="font-semibold">{student?.name}</span>
          <span className="tabular ml-2 text-xs text-fg-muted">{student?.studentId}</span>
        </div>
        {drawnQuestions.length > 0 && (
          <Button variant="ghost" size="sm" onPress={draw} isPending={drawing}>
            <Icon icon="lucide:shuffle" width={14} />
            {t("redraw")}
          </Button>
        )}
      </div>

      {drawnQuestions.length === 0 ? (
        <motion.button
          type="button"
          onClick={draw}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-line py-16 transition-colors hover:border-brand-500/40 hover:bg-brand-500/5"
        >
          <motion.div
            animate={drawing ? { rotate: [0, -8, 8, -8, 0], scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.6, repeat: drawing ? Infinity : 0 }}
            className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white shadow-lg shadow-brand-600/30"
          >
            <Icon icon="lucide:dices" width={28} />
          </motion.div>
          <span className="text-sm font-semibold text-fg-muted">
            {drawing ? "…" : t("drawQuestions")}
          </span>
        </motion.button>
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {drawnQuestions.map((q, i) => (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: 24, rotateX: -30 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{
                    duration: 0.5,
                    delay: i * 0.12,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="rounded-2xl border border-line bg-elevated p-5"
                  style={{ transformPerspective: 800 }}
                >
                  <div className="flex items-start gap-3">
                    <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-500/15 to-amber-500/10 text-xs font-bold text-brand-600 dark:text-brand-300">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-sm leading-relaxed">{q.content}</p>
                  </div>
                  <div className="mt-4 flex gap-2 pl-9">
                    {marks.map((mark) => {
                      const meta = MARK_META[mark];
                      const active = questionMarks[q.id] === mark;
                      return (
                        <motion.button
                          key={mark}
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          onClick={() => markQuestion(q.id, mark)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                            active ? meta.activeClass : meta.className,
                          )}
                        >
                          <Icon icon={meta.icon} width={13} />
                          {t(`question${mark[0].toUpperCase()}${mark.slice(1)}`)}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-5 flex justify-end"
          >
            <Button size="lg" onPress={onNext} className="bg-gradient-to-r from-brand-600 to-brand-700 shadow-lg shadow-brand-600/25">
              {t("stepScore")}
              <Icon icon="lucide:arrow-right" width={16} />
            </Button>
          </motion.div>
        </>
      )}
    </div>
  );
}
