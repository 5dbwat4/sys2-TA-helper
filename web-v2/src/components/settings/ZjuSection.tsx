"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Chip, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { SettingsCard, settingsInputClass } from "./SettingsCard";
import { settingsPatch, useSettings } from "@/lib/use-settings";
import { useApiError } from "@/lib/use-api-error";

export function ZjuSection() {
  const t = useTranslations("settings");
  const errorMessage = useApiError();
  const { data, mutate } = useSettings();

  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  const saved = data?.zjuam.boundRemotely ?? false;

  const save = async () => {
    setBusy(true);
    const r = await settingsPatch({
      action: "zjuam_save_remote",
      account: account.trim(),
      password,
    });
    setBusy(false);
    if (r.ok) {
      toast.success(t("saved"));
      setOpen(false);
      setPassword("");
      mutate();
    } else {
      toast.error(errorMessage(r.error));
    }
  };

  const remove = async () => {
    setRemoving(true);
    const r = await settingsPatch({ action: "zjuam_remove_remote" });
    setRemoving(false);
    if (r.ok) {
      toast.success(t("removed"));
      mutate();
    } else {
      toast.error(errorMessage(r.error));
    }
  };

  return (
    <SettingsCard
      icon="lucide:university"
      title={t("zjuSection")}
      description={t("zjuDesc")}
      index={2}
    >
      <div className="rounded-xl bg-sunken p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Icon
              icon={saved ? "lucide:cloud-upload" : "lucide:cloud-off"}
              width={16}
              className={saved ? "text-emerald-500" : "text-fg-muted"}
            />
            <div>
              <div className="text-sm font-semibold">
                {saved ? t("zjuSaved") : t("zjuNotSaved")}
              </div>
              {saved && data?.zjuam.account && (
                <div className="tabular text-xs text-fg-muted">{data.zjuam.account}</div>
              )}
            </div>
            <Chip size="sm" color={saved ? "success" : "default"} variant="soft">
              {saved ? "REMOTE" : "LOCAL"}
            </Chip>
          </div>
          <div className="flex gap-2">
            {saved && (
              <Button size="sm" variant="ghost" className="text-danger" isPending={removing} onPress={remove}>
                {({ isPending }) => (
                  <>
                    {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:trash-2" width={13} />}
                    {t("zjuRemove")}
                  </>
                )}
              </Button>
            )}
            <Button size="sm" variant="secondary" onPress={() => setOpen((v) => !v)}>
              <Icon icon={open ? "lucide:x" : "lucide:cloud-upload"} width={13} />
              {open ? "✕" : t("zjuSave")}
            </Button>
          </div>
        </div>

        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 space-y-3 overflow-hidden border-t border-line pt-4"
          >
            <input
              className={settingsInputClass + " tabular"}
              placeholder={t("zjuAccount")}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              autoComplete="off"
            />
            <input
              type="password"
              className={settingsInputClass}
              placeholder={t("zjuPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-[11px] leading-relaxed text-fg-subtle">{t("zjuSaveHint")}</p>
            <Button
              fullWidth
              isPending={busy}
              isDisabled={!account.trim() || !password}
              onPress={save}
              className="bg-gradient-to-r from-brand-600 to-brand-700"
            >
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:cloud-upload" width={15} />}
                  {t("zjuSave")}
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </SettingsCard>
  );
}
