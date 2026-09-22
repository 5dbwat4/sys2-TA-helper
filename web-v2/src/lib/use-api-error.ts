"use client";

import { useTranslations } from "next-intl";

/**
 * Maps API error codes to localized messages.
 * Usage: const errorMessage = useApiError();
 *        toast.error(errorMessage(data.error));
 */
export function useApiError() {
  const t = useTranslations("errors");

  return (code: string | undefined): string => {
    if (!code) return t("INTERNAL_ERROR");
    try {
      return t(code as never);
    } catch {
      return t("INTERNAL_ERROR");
    }
  };
}

/** Extract `{ error }` from a failed fetch response, safely. */
export async function readApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : "INTERNAL_ERROR";
  } catch {
    return "INTERNAL_ERROR";
  }
}
