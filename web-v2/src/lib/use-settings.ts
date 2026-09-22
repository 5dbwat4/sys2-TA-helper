"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-hooks";

export type SettingsData = {
  studentId: string;
  name: string;
  username: string | null;
  hasPassword: boolean;
  passkeys: { id: string; createdAt: string; deviceType: string }[];
  zjuam: { boundRemotely: boolean; account: string | null };
};

export function useSettings() {
  return useSWR<SettingsData>("/api/settings", fetcher);
}

export async function settingsPatch(body: Record<string, unknown>): Promise<{
  ok: boolean;
  error?: string;
}> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data.error ?? "INTERNAL_ERROR" };
}
