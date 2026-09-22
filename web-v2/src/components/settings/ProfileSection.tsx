"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Chip, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { SettingsCard, settingsInputClass } from "./SettingsCard";
import { settingsPatch, useSettings } from "@/lib/use-settings";
import { useApiError } from "@/lib/use-api-error";

function UsernameRow({ username, onSaved }: { username: string | null; onSaved: () => void }) {
  const t = useTranslations("settings");
  const errorMessage = useApiError();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(username ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await settingsPatch({ action: "set_username", username: value.trim() });
    setBusy(false);
    if (r.ok) {
      toast.success(t("saved"));
      setEditing(false);
      onSaved();
    } else {
      toast.error(errorMessage(r.error));
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-sunken px-4 py-3">
      <div>
        <div className="text-xs font-semibold text-fg-muted">{t("username")}</div>
        {editing ? (
          <input
            className={settingsInputClass + " mt-1.5"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            minLength={2}
            maxLength={32}
            autoFocus
          />
        ) : (
          <div className="mt-0.5 font-semibold">{username ?? "—"}</div>
        )}
      </div>
      {editing ? (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onPress={() => { setEditing(false); setValue(username ?? ""); }}>
            <Icon icon="lucide:x" width={14} />
          </Button>
          <Button size="sm" isPending={busy} onPress={save}>
            {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:check" width={14} />)}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onPress={() => setEditing(true)}>
          <Icon icon="lucide:pen" width={14} />
          {t("usernameChange")}
        </Button>
      )}
    </div>
  );
}

export function ProfileSection() {
  const t = useTranslations("settings");
  const { data, mutate } = useSettings();

  return (
    <SettingsCard icon="lucide:id-card" title={t("profile")} index={0}>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-sunken px-4 py-3">
          <div>
            <div className="text-xs font-semibold text-fg-muted">ID</div>
            <div className="tabular mt-0.5 font-semibold">{data?.studentId ?? "—"}</div>
          </div>
          <Chip size="sm" color="accent" variant="soft">TA</Chip>
        </div>
        <UsernameRow username={data?.username ?? null} onSaved={() => mutate()} />
      </div>
    </SettingsCard>
  );
}
