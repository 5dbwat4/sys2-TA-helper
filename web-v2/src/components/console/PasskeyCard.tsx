"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { startRegistration } from "@simplewebauthn/browser";
import { Icon } from "@/components/ui/Icon";

/** Card that lets a logged-in TA bind the current device as a passkey. */
export function PasskeyCard() {
  const t = useTranslations("console");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const register = async () => {
    setLoading(true);
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
      setDone(true);
      toast.success(t("passkeyBindSuccess"));
    } catch (err) {
      if ((err as Error).name !== "NotAllowedError") toast.error(t("passkeyBindFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-950 to-brand-900 p-6 text-white"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/20 blur-[60px]" />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Icon icon="lucide:fingerprint" width={16} className="text-amber-400" />
          {t("passkeyTitle")}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{t("passkeyDesc")}</p>
        <Button
          className="mt-4 bg-white/10 text-white backdrop-blur hover:bg-white/20"
          variant="ghost"
          isPending={loading}
          onPress={register}
          isDisabled={done}
        >
          {({ isPending }) => (
            <>
              {isPending ? (
                <Spinner color="current" size="sm" />
              ) : (
                <Icon icon={done ? "lucide:check" : "lucide:plus"} width={16} />
              )}
              {done ? t("passkeyBound") : t("passkeyBind")}
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
