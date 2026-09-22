"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-hooks";

export type StudentDashboard = {
  student: { studentId: string; name: string; role: string; hasCheckpoint: boolean };
  board: {
    assetNo: string;
    dbNo: string;
    contactPhone: string | null;
    isReturned: boolean;
    assignedAt: string;
    teamMembers: string[];
  } | null;
  grades: {
    experimentId: string;
    experimentNumber: string;
    experimentName: string;
    type: string;
    courseWeight: number;
    courseScore: number | null;
    acceptanceRatio: number;
    reportRatio: number;
    codeRatio: number;
    submission: {
      reportScore: number | null;
      codeScore: number | null;
      acceptanceScore: number | null;
      checkpointClaimed: boolean;
      isPlagiarised: boolean;
      remark: string | null;
      finalScore: number | null;
    } | null;
    status: "GRADED" | "PENDING" | "NOT_SUBMITTED";
  }[];
  courseSummary: { totalEarned: number; maxPossible: number };
};

export function useStudentDashboard() {
  return useSWR<StudentDashboard>("/api/student/dashboard", fetcher, {
    refreshInterval: 60_000,
  });
}
