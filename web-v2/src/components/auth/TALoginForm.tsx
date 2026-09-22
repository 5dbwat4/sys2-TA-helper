"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Icon } from "@/components/ui/Icon";

const inputClass =
  "w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-fg placeholder:text-fg-subtle outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function TALoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"zjuam" | "passkey" | null>(null);

  const zjuamLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("zjuam");
    try {
      const res = await fetch("/api/auth/zjuam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: account.trim(), password }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("login") + " ✓");
      router.replace("/console");
      router.refresh();
    } catch {
      toast.error(t("loginFailed"));
    } finally {
      setLoading(null);
    }
  };

  const passkeyLogin = async () => {
    setLoading("passkey");
    try {
      const optionsRes = await fetch("/api/auth/passkey/generate-authentication");
      if (!optionsRes.ok) throw new Error();
      const options = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/passkey/verify-authentication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) throw new Error();
      toast.success(t("login") + " ✓");
      router.replace("/console");
      router.refresh();
    } catch (err) {
      if ((err as Error).name !== "NotAllowedError") toast.error(t("passkeyNotRegistered"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Passkey — primary */}
      <Button
        size="lg"
        fullWidth
        isPending={loading === "passkey"}
        onPress={passkeyLogin}
        className="bg-gradient-to-r from-brand-600 to-brand-700 shadow-lg shadow-brand-600/25"
      >
        {({ isPending }) => (
          <>
            {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:fingerprint" width={20} />}
            {t("passkeyLogin")}
          </>
        )}
      </Button>
      <p className="-mt-2 text-center text-xs text-fg-subtle">{t("passkeyLoginHint")}</p>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">ZJUAM</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={zjuamLogin} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("zjuamAccount")}</label>
          <input
            className={inputClass + " tabular"}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={t("studentIdPlaceholder")}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("zjuamPassword")}</label>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" variant="secondary" fullWidth isPending={loading === "zjuam"}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:key-round" width={16} />}
              {t("zjuamLogin")}
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
}
