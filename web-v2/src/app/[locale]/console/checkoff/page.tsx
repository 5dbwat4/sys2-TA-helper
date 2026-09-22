"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@heroui/react";
import { useRouter } from "@/i18n/navigation";
import { useCheckoffModeLoaded } from "@/lib/use-checkoff-mode";
import {
  CheckoffContext,
  type CheckoffState,
  type Experiment,
  type MatchedStudent,
  type Step,
} from "@/components/checkoff/checkoff-store";
import { StepIndicator } from "@/components/checkoff/StepIndicator";
import { ExperimentPicker } from "@/components/checkoff/ExperimentPicker";
import { StudentFinder } from "@/components/checkoff/StudentFinder";
import { QuestionDrawer } from "@/components/checkoff/QuestionDrawer";
import { ScoreForm } from "@/components/checkoff/ScoreForm";

export default function CheckoffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <CheckoffWizard />
    </Suspense>
  );
}

function CheckoffWizard() {
  const t = useTranslations("checkoff");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, modeLoaded] = useCheckoffModeLoaded();

  // Multi-device mode lives on its own page
  useEffect(() => {
    if (modeLoaded && mode === "multi") router.replace("/console/checkoff/multi");
  }, [mode, modeLoaded, router]);

  const [step, setStep] = useState<Step>(0);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [student, setStudent] = useState<MatchedStudent | null>(null);
  const [drawnQuestions, setDrawnQuestions] = useState<Experiment["questions"]>([]);
  const [questionMarks, setQuestionMarks] = useState<CheckoffState["questionMarks"]>({});
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  useEffect(() => {
    fetch("/api/checkoff")
      .then((r) => r.json())
      .then((data) => {
        const list: Experiment[] = data.experiments ?? [];
        setExperiments(list);
        const wanted = searchParams.get("experimentId");
        const preselect = list.find((e) => e.id === wanted) ?? list.find((e) => e.isPublished) ?? null;
        if (preselect) {
          setExperiment(preselect);
          setStep(1);
        }
      });
  }, [searchParams]);

  const selectExperiment = useCallback((e: Experiment) => {
    setExperiment(e);
    setStudent(null);
    setDrawnQuestions([]);
    setQuestionMarks({});
    setQuestionIndex(0);
    setStep(1);
  }, []);

  const selectStudent = useCallback(
    (s: MatchedStudent | null) => {
      setStudent(s);
      setDrawnQuestions([]);
      setQuestionMarks({});
      setQuestionIndex(0);
      if (s) setStep(experiment && experiment.questions.length > 0 ? 2 : 3);
      else setStep(1);
    },
    [experiment],
  );

  const markQuestion = useCallback((id: string, mark: "correct" | "partial" | "wrong") => {
    setQuestionMarks((prev) => ({ ...prev, [id]: prev[id] === mark ? undefined : mark }));
  }, []);

  const reset = useCallback(() => {
    setStudent(null);
    setDrawnQuestions([]);
    setQuestionMarks({});
    setQuestionIndex(0);
    setStep(1);
  }, []);

  const store = useMemo<CheckoffState>(
    () => ({
      step,
      setStep,
      experiment,
      selectExperiment,
      student,
      selectStudent,
      drawnQuestions,
      setDrawnQuestions,
      questionMarks,
      markQuestion,
      reset,
    }),
    [step, experiment, student, drawnQuestions, questionMarks, selectExperiment, selectStudent, markQuestion, reset],
  );

  if (!experiments) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <CheckoffContext.Provider value={store}>
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 flex items-end justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
            {experiment && (
              <p className="tabular mt-1 text-sm text-fg-muted">
                Lab {experiment.number} · {experiment.name}
              </p>
            )}
          </div>
        </motion.div>

        <StepIndicator />

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 && <ExperimentPicker experiments={experiments} onSelect={selectExperiment} />}
              {step === 1 && experiment && (
                <StudentFinder experiment={experiment} onSelect={selectStudent} />
              )}
              {step === 2 && (
                <QuestionDrawer
                  onNext={() => setStep(3)}
                  questionIndex={questionIndex}
                  onQuestionIndex={setQuestionIndex}
                />
              )}
              {step === 3 && <ScoreForm onSaved={reset} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </CheckoffContext.Provider>
  );
}
