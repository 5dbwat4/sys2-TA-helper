"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { startRegistration } from "@simplewebauthn/browser";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useApiError, readApiError } from "@/lib/use-api-error";

const inputClass =
  "w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-fg placeholder:text-fg-subtle outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export default function SetupPage() {
  const t = useTranslations("auth.setup");
  const errorMessage = useApiError();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [passkeyBound, setPasskeyBound] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const bindPasskey = async () => {
    setPasskeyLoading(true);
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
      setPasskeyBound(true);
      toast.success(t("passkeyBoundState"));
    } catch (err) {
      if ((err as Error).name !== "NotAllowedError") toast.error("✗");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password && password !== password2) {
      toast.error(t("passwordMismatch"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password || undefined }),
      });
      if (!res.ok) {
        toast.error(errorMessage(await readApiError(res)));
        return;
      }
      toast.success("✓");
      router.replace("/console");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30"
          >
            <Icon icon="lucide:user-cog" width={26} />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t("subtitle")}</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* username — required */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-fg-muted">
              {t("usernameRequired")}
            </label>
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ta_wrc"
              minLength={2}
              maxLength={32}
              pattern="[a-zA-Z0-9_.\-]+"
              autoComplete="username"
              required
            />
          </div>

          {/* password — optional */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-fg-muted">
              {t("passwordOptional")}
            </label>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              minLength={8}
              autoComplete="new-password"
            />
            {password && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 overflow-hidden"
              >
                <label className="mb-1.5 block text-xs font-semibold text-fg-muted">
                  {t("passwordConfirm")}
                </label>
                <input
                  type="password"
                  className={inputClass}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="········"
                  autoComplete="new-password"
                />
              </motion.div>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-fg-subtle">{t("passwordHint")}</p>
          </div>

          {/* passkey — optional */}
          <div className="rounded-2xl border border-dashed border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300">
                  <Icon icon="lucide:fingerprint" width={17} />
                </div>
                <div>
                  <div className="text-xs font-semibold">{t("passkeyOptional")}</div>
                  <div className="text-[11px] text-fg-subtle">Touch ID · Face ID · Hello</div>
                </div>
              </div>
              <Button
                size="sm"
                variant={passkeyBound ? "ghost" : "secondary"}
                isPending={passkeyLoading}
                isDisabled={passkeyBound}
                onPress={bindPasskey}
              >
                {({ isPending }) => (
                  <>
                    {isPending ? (
                      <Spinner color="current" size="sm" />
                    ) : (
                      <Icon icon={passkeyBound ? "lucide:check" : "lucide:plus"} width={14} />
                    )}
                    {passkeyBound ? t("passkeyBoundState") : t("passkeyBindNow")}
                  </>
                )}
              </Button>
            </div>
          </div>

          <Button type="submit" fullWidth size="lg" isPending={saving} className="mt-2 bg-gradient-to-r from-brand-600 to-brand-700 shadow-lg shadow-brand-600/25">
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:arrow-right" width={16} />}
                {t("complete")}
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
