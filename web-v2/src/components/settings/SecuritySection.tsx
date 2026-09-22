"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import { Icon } from "@/components/ui/Icon";
import { SettingsCard, settingsInputClass } from "./SettingsCard";
import { settingsPatch, useSettings } from "@/lib/use-settings";
import { useApiError } from "@/lib/use-api-error";
import { cn } from "@/lib/utils";

function PasswordPanel({ hasPassword, onChanged }: { hasPassword: boolean; onChanged: () => void }) {
  const t = useTranslations("settings");
  const errorMessage = useApiError();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await settingsPatch({
      action: "set_password",
      newPassword: next,
      currentPassword: current || undefined,
    });
    setBusy(false);
    if (r.ok) {
      toast.success(t("saved"));
      setOpen(false);
      setCurrent("");
      setNext("");
      onChanged();
    } else {
      toast.error(errorMessage(r.error));
    }
  };

  const remove = async () => {
    const r = await settingsPatch({ action: "remove_password" });
    if (r.ok) {
      toast.success(t("removed"));
      onChanged();
    } else {
      toast.error(errorMessage(r.error));
    }
  };

  return (
    <div className="rounded-xl bg-sunken p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon icon={hasPassword ? "lucide:lock" : "lucide:lock-open"} width={15} className="text-fg-muted" />
          <span className="text-sm font-semibold">
            {hasPassword ? t("passwordSet") : t("passwordNotSet")}
          </span>
        </div>
        <div className="flex gap-2">
          {hasPassword && (
            <Button size="sm" variant="ghost" className="text-danger" onPress={remove}>
              <Icon icon="lucide:trash-2" width={13} />
              {t("passwordRemove")}
            </Button>
          )}
          <Button size="sm" variant="secondary" onPress={() => setOpen((v) => !v)}>
            <Icon icon={open ? "lucide:x" : hasPassword ? "lucide:pen" : "lucide:plus"} width={13} />
            {open ? "✕" : hasPassword ? t("passwordChange") : t("passwordAdd")}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {hasPassword && (
            <input
              type="password"
              className={settingsInputClass}
              placeholder={t("currentPassword")}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          )}
          <div className="flex gap-2">
            <input
              type="password"
              className={settingsInputClass}
              placeholder={t("newPassword") + " (≥ 8)"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
            <Button isPending={busy} isDisabled={next.length < 8} onPress={save}>
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:check" width={15} />)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PasskeyList({
  passkeys,
  onChanged,
}: {
  passkeys: { id: string; createdAt: string; deviceType: string }[];
  onChanged: () => void;
}) {
  const t = useTranslations("settings");
  const errorMessage = useApiError();
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const add = async () => {
    setAdding(true);
    try {
      const optionsRes = await fetch("/api/auth/passkey/generate-registration");
      if (!optionsRes.ok) throw new Error();
      const options = await optionsRes.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/passkey/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      if (!verifyRes.ok) throw new Error();
      toast.success(t("passkeyBound"));
      onChanged();
    } catch (err) {
      if ((err as Error).name !== "NotAllowedError") toast.error(errorMessage("VERIFICATION_FAILED"));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    const r = await settingsPatch({ action: "remove_passkey", passkeyId: id });
    setRemovingId(null);
    if (r.ok) {
      toast.success(t("removed"));
      onChanged();
    } else {
      toast.error(errorMessage(r.error));
    }
  };

  return (
    <div className="rounded-xl bg-sunken p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon icon="lucide:fingerprint" width={15} className="text-fg-muted" />
          {t("passkeySection")}
        </span>
        <Button size="sm" variant="secondary" isPending={adding} onPress={add}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:plus" width={13} />}
              {t("passkeyAdd")}
            </>
          )}
        </Button>
      </div>

      {passkeys.length === 0 ? (
        <p className="py-3 text-center text-xs text-fg-subtle">{t("passkeyEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center gap-3 rounded-lg bg-elevated px-3 py-2.5 ring-1 ring-line"
            >
              <Icon
                icon={pk.deviceType === "multiDevice" ? "lucide:smartphone" : "lucide:laptop"}
                width={15}
                className="text-fg-muted"
              />
              <span className="tabular flex-1 text-xs text-fg-muted">
                {new Date(pk.createdAt).toLocaleDateString()} · {pk.deviceType === "multiDevice" ? "Synced" : "This device"}
              </span>
              <button
                type="button"
                onClick={() => remove(pk.id)}
                disabled={removingId === pk.id}
                className={cn(
                  "rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger",
                  removingId === pk.id && "opacity-50",
                )}
                aria-label={t("passkeyRemove")}
              >
                {removingId === pk.id ? <Spinner size="sm" /> : <Icon icon="lucide:trash-2" width={13} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SecuritySection() {
  const t = useTranslations("settings");
  const { data, mutate } = useSettings();

  return (
    <SettingsCard
      icon="lucide:shield-check"
      title={t("security")}
      description={t("primaryNote")}
      index={1}
    >
      <div className="space-y-3">
        <PasswordPanel hasPassword={data?.hasPassword ?? false} onChanged={() => mutate()} />
        <PasskeyList passkeys={data?.passkeys ?? []} onChanged={() => mutate()} />
      </div>
    </SettingsCard>
  );
}
