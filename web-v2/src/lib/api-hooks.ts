"use client";

import useSWR from "swr";

export type ConsoleSummary = {
  totalStudents: number;
  unreturnedBoards: number;
  activeExperiment: {
    id: string;
    number: string;
    name: string;
    checkedCount: number;
    totalStudents: number;
  } | null;
  experimentCount: number;
  activity: { kind: "checkoff" | "lend" | "return"; at: string; text: string }[];
};

export const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

export function useConsoleSummary() {
  return useSWR<ConsoleSummary>("/api/console/summary", fetcher, {
    refreshInterval: 30_000,
  });
}
