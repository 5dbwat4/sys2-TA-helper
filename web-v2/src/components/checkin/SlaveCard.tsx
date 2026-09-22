"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SlaveCardState } from "@/lib/use-checkoff-socket";

const variants = {
  enter: { x: 320, opacity: 0, scale: 0.94 },
  center: { x: 0, opacity: 1, scale: 1 },
  exit: { x: -320, opacity: 0, scale: 0.94 },
};

function IdleCard({ experimentNumber, experimentName }: { experimentNumber: string; experimentName: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30"
      >
        <Icon icon="lucide:clipboard-check" width={30} />
      </motion.div>
      <p className="text-sm font-medium text-fg-muted">此处可验收</p>
      <h2 className="tabular mt-2 text-4xl font-bold tracking-tight">Lab {experimentNumber}</h2>
      {experimentName && <p className="mt-2 text-sm text-fg-subtle">{experimentName}</p>}
      <div className="mt-8 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-brand-400"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }}
          />
        ))}
      </div>
    </div>
  );
}

function AskCard() {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30"
      >
        <Icon icon="lucide:user-round" width={30} />
      </motion.div>
      <h2 className="text-2xl font-bold tracking-tight">您的姓名 / 学号？</h2>
      <p className="mt-3 text-sm text-fg-muted">请告诉助教</p>
      <div className="mt-8 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-amber-400"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  studentName,
  index,
  total,
  content,
}: {
  studentName: string;
  index: number;
  total: number;
  content: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-xs font-bold text-brand-600 dark:text-brand-300">
            {studentName.slice(0, 1)}
          </span>
          <span className="truncate text-sm font-semibold">{studentName}</span>
        </span>
        <span className="tabular shrink-0 text-xs font-bold uppercase tracking-widest text-fg-subtle">
          问题 {index} / {total}
        </span>
      </div>
      <div className="mt-5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-amber-500/10 text-brand-600 dark:text-brand-300">
        <Icon icon="lucide:help-circle" width={20} />
      </div>
      <p className="mt-4 text-xl font-semibold leading-relaxed">{content}</p>
    </div>
  );
}

function ThanksCard({ studentName }: { studentName?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-600/30"
      >
        <Icon icon="lucide:check" width={32} />
      </motion.div>
      <h2 className="text-2xl font-bold tracking-tight">感谢您参加验收</h2>
      {studentName && <p className="mt-2 text-sm text-fg-muted">{studentName}</p>}
    </div>
  );
}

export function SlaveCard({
  state,
  cardKey,
}: {
  state: SlaveCardState;
  cardKey: string;
}) {
  return (
    <div className="relative min-h-72">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cardKey}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="checkin-card w-full rounded-3xl border p-8 shadow-xl shadow-brand-950/5 transition-shadow duration-300 hover:shadow-2xl hover:shadow-brand-600/20"
        >
          {state.kind === "idle" && (
            <IdleCard experimentNumber={state.experimentNumber} experimentName={state.experimentName} />
          )}
          {state.kind === "ask" && <AskCard />}
          {state.kind === "question" && (
            <QuestionCard
              studentName={state.studentName}
              index={state.index}
              total={state.total}
              content={state.content}
            />
          )}
          {state.kind === "thanks" && <ThanksCard studentName={state.studentName} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Derive a stable key for slide transitions. */
export function slaveCardKey(state: SlaveCardState | null): string {
  if (!state) return "loading";
  if (state.kind === "question") return `q-${state.index}-${state.content.slice(0, 8)}`;
  return state.kind;
}

/** Live region announcements for screen readers. */
export function useSlaveAnnouncer(state: SlaveCardState | null) {
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!state) return;
    setAnnouncement(
      state.kind === "idle"
        ? `此处可验收 Lab ${state.experimentNumber}`
        : state.kind === "ask"
          ? "请输入学号或姓名"
          : state.kind === "question"
            ? `问题 ${state.index}，共 ${state.total} 题`
            : "验收完成，感谢参加",
    );
  }, [state]);
  return announcement;
}
