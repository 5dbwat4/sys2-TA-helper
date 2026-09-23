"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { joinByCode } from "@/lib/use-checkoff-socket";
import { Icon } from "@/components/ui/Icon";

export default function CheckinJoinPage() {
  const t = useTranslations("checkin");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = code.length === 6 && !busy;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const res = await joinByCode(code);
    if (res.token) {
      router.replace(`/checkin/${res.token}`);
    } else {
      setBusy(false);
      setError(t("joinNotFound"));
    }
  };

  return (
    <div className="checkin-bg relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-2 text-fg-subtle">
        <Icon icon="lucide:cpu" width={15} />
        <span className="text-xs font-semibold uppercase tracking-[0.25em]">CS-II Checkoff</span>
      </div>

      <div className="w-full max-w-md">
        <form
          onSubmit={submit}
          className="glass flex flex-col items-center rounded-3xl border border-line p-8 text-center shadow-xl shadow-brand-950/5 transition-shadow duration-300 hover:shadow-2xl hover:shadow-brand-600/20"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
            <Icon icon="lucide:key-round" width={30} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("joinTitle")}</h1>
          <p className="mt-2 text-sm text-fg-muted">{t("joinHint")}</p>

          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              if (text) {
                e.preventDefault();
                setCode(text);
                setError(null);
              }
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            aria-label={t("joinTitle")}
            className="tabular mt-6 w-full rounded-2xl border border-line bg-sunken px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />

          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-red-500">
              <Icon icon="lucide:triangle-alert" width={14} />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!ready}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Icon icon="lucide:arrow-right" width={16} />
            )}
            {t("joinSubmit")}
          </button>
        </form>
      </div>
    </div>
  );
}