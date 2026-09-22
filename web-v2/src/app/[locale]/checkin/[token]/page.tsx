"use client";

import { use, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSlaveSession } from "@/lib/use-checkoff-socket";
import { SlaveCard, slaveCardKey, useSlaveAnnouncer } from "@/components/checkin/SlaveCard";
import { Icon } from "@/components/ui/Icon";

export default function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations("checkin");
  const { subscribe, getSnapshot, getServerSnapshot } = useSlaveSession(token);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const announcement = useSlaveAnnouncer(snapshot.state);

  return (
    <div className="checkin-bg relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <span aria-live="polite" className="sr-only">{announcement}</span>

      {/* top brand */}
      <div className="absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-2 text-fg-subtle">
        <Icon icon="lucide:cpu" width={15} />
        <span className="text-xs font-semibold uppercase tracking-[0.25em]">CS-II Checkoff</span>
      </div>

      <div className="w-full max-w-md">
        {!snapshot.connected ? (
          <div className="glass flex min-h-72 items-center justify-center rounded-3xl border border-line p-8 shadow-xl shadow-brand-950/5">
            <div className="flex flex-col items-center gap-3 text-fg-subtle">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-500" />
              <span className="text-sm">Connecting…</span>
            </div>
          </div>
        ) : snapshot.error && !snapshot.state ? (
          <div className="glass flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border border-line p-8 text-center shadow-xl shadow-brand-950/5">
            <Icon icon="lucide:unlink" width={28} className="text-fg-subtle" />
            <p className="text-sm text-fg-muted">{t("joinNotFound")}</p>
            <Link
              href="/checkin"
              className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/25"
            >
              {t("joinTitle")}
            </Link>
          </div>
        ) : snapshot.closed ? (
          <div className="glass flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-line p-8 text-center shadow-xl shadow-brand-950/5">
            <Icon icon="lucide:unlink" width={28} className="text-fg-subtle" />
            <p className="text-sm text-fg-muted">会话已结束</p>
          </div>
        ) : snapshot.state ? (
          <SlaveCard state={snapshot.state} cardKey={slaveCardKey(snapshot.state)} />
        ) : null}
      </div>
    </div>
  );
}
