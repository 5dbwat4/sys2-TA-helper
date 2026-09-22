"use client";

import { createContext, useContext } from "react";

export type Experiment = {
  id: string;
  number: string;
  name: string;
  isPublished: boolean;
  courseWeight: number;
  acceptanceRatio: number;
  reportRatio: number;
  codeRatio: number;
  questions: { id: string; content: string }[];
};

export type MatchedStudent = {
  id: string;
  studentId: string;
  name: string;
  pinyin: string | null;
  hasCheckpoint: boolean;
  board: {
    id: string;
    assetNo: string;
    dbNo: string;
    contactPhone: string | null;
    isShared: boolean;
    teamMembers: string[];
  } | null;
  submission: {
    acceptanceScore: number | null;
    codeScore: number | null;
    checkpointClaimed: boolean;
    remark: string | null;
  } | null;
};

export type Step = 0 | 1 | 2 | 3;

export interface CheckoffState {
  step: Step;
  setStep: (s: Step) => void;
  experiment: Experiment | null;
  selectExperiment: (e: Experiment) => void;
  student: MatchedStudent | null;
  selectStudent: (s: MatchedStudent | null) => void;
  drawnQuestions: { id: string; content: string }[];
  setDrawnQuestions: (q: { id: string; content: string }[]) => void;
  questionMarks: Record<string, "correct" | "partial" | "wrong" | undefined>;
  markQuestion: (id: string, mark: "correct" | "partial" | "wrong") => void;
  reset: () => void;
}

export const CheckoffContext = createContext<CheckoffState | null>(null);

export function useCheckoff(): CheckoffState {
  const ctx = useContext(CheckoffContext);
  if (!ctx) throw new Error("useCheckoff must be used within CheckoffContext");
  return ctx;
}
