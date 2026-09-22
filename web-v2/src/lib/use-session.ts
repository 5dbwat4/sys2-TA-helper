"use client";

import useSWR from "swr";

export type Session = {
  authenticated: boolean;
  user: { id: string; studentId: string; name: string; role: "STUDENT" | "TA" | "TEACHER" };
};

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<Session>("/api/auth/session", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return {
    session: data?.authenticated ? data.user : null,
    isLoading: isLoading && !error,
    mutate,
  };
}
