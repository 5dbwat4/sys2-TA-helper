"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Icon } from "@/components/ui/Icon";
import { useApiError, readApiError } from "@/lib/use-api-error";

const inputClass =
  "w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-fg placeholder:text-fg-subtle outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-line" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">{label}</span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

function PasswordLogin() {
  const t = useTranslations("auth");
  const errorMessage = useApiError();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/ta-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        toast.error(errorMessage(await readApiError(res)));
        return;
      }
      toast.success(t("login") + " ✓");
      router.replace("/console");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("username")}</label>
        <input
          className={inputClass}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("usernamePlaceholder")}
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("password")}</label>
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
      <Button type="submit" fullWidth isPending={loading} className="mt-1">
        {({ isPending }) => (
          <>
            {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:arrow-right" width={16} />}
            {t("taLogin")}
          </>
        )}
      </Button>
    </form>
  );
}

function ZjuamLogin() {
  const t = useTranslations("auth");
  const errorMessage = useApiError();
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/zjuam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: account.trim(), password, scope: "local" }),
      });
      if (!res.ok) {
        toast.error(errorMessage(await readApiError(res)));
        return;
      }
      const data = await res.json();
      if (data.status === "SETUP_REQUIRED") {
        router.replace("/setup");
        return;
      }
      toast.success(t("login") + " ✓");
      router.replace("/console");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
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
      <Button type="submit" variant="secondary" fullWidth isPending={loading}>
        {({ isPending }) => (
          <>
            {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:university" width={16} />}
            {t("zjuamLogin")}
          </>
        )}
      </Button>
    </form>
  );
}

export function TALoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [method, setMethod] = useState<"password" | "zjuam">("password");
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const passkeyLogin = async () => {
    setPasskeyLoading(true);
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
      setPasskeyLoading(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* primary method toggle */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-sunken p-1">
        {(["password", "zjuam"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={
              "relative rounded-lg py-2 text-xs font-semibold transition-colors " +
              (method === m ? "text-fg" : "text-fg-subtle hover:text-fg-muted")
            }
          >
            {method === m && (
              <motion.span
                layoutId="ta-method-pill"
                className="absolute inset-0 rounded-lg bg-elevated shadow-sm ring-1 ring-line"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">
              <Icon icon={m === "password" ? "lucide:key-round" : "lucide:university"} width={13} />
              {m === "password" ? t("taLogin") : "ZJUAM"}
            </span>
          </button>
        ))}
      </div>

      {method === "password" ? <PasswordLogin /> : <ZjuamLogin />}

      <Divider label={t("otherMethods")} />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" isPending={passkeyLoading} onPress={passkeyLogin}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:fingerprint" width={16} />}
              Passkey
            </>
          )}
        </Button>
        <Link href="/login/token" className="contents">
          <Button variant="ghost">
            <Icon icon="lucide:ticket" width={16} />
            Token
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
