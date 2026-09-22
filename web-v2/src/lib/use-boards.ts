"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-hooks";

export type Board = {
  id: string;
  assetNo: string;
  dbNo: string;
  contactPhone: string | null;
  isBorrowed: boolean;
  currentStudent: { studentId: string; name: string; assignedAt: string } | null;
  allBorrowers: { studentId: string; name: string }[];
};

export type BoardsData = {
  boards: Board[];
  students: { id: string; studentId: string; name: string }[];
};

export function useBoards() {
  return useSWR<BoardsData>("/api/boards", fetcher, { refreshInterval: 30_000 });
}
