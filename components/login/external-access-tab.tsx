"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { useTranslations } from "next-intl";

import { OtpInput } from "@/components/otp-input";

export type ExternalAudience = "CLIENTE" | "TERCERO";

type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

export function ExternalAccessTab({
  audience,
  loading,
  setLoading,
  setToast,
}: {
  audience: ExternalAudience;
  loading: boolean;
  setLoading: (next: boolean) => void;
  setToast: (toast: ToastState | null) => void;
}) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [clientCode, setClientCode] = useState("");
  const [otp, setOtp] = useState("");
  const [tokenSent, setTokenSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [retryAt, setRetryAt] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);

    return () => window.clearInterval(id);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!retryAt) return 0;
    const ms = new Date(retryAt).getTime() - nowTick;

    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  }, [retryAt, nowTick]);

  const requestToken = async () => {
    if (!clientCode.trim()) {
      setToast({ message: t("clientIdRequired"), type: "error" });

      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/external-auth/request-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode: clientCode.trim().toUpperCase(),
          audience,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof body?.message === "string" ? body.message : t("tokenSendError");

        if (body?.retryAt) setRetryAt(String(body.retryAt));
        setToast({ message: msg, type: "error" });

        return;
      }

      setRetryAt(typeof body?.retryAt === "string" ? body.retryAt : null);
      setTokenSent(true);
      setVerified(false);
      setOtp("");
      setToast({ message: t("tokenSent"), type: "success" });
    } catch {
      setToast({ message: t("tokenSendError"), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    if (!clientCode.trim() || otp.length !== 6) {
      setToast({ message: t("otpAndClientRequired"), type: "error" });

      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/external-auth/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode: clientCode.trim().toUpperCase(),
          audience,
          token: otp,
        }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({ message: text || t("invalidToken"), type: "error" });

        return;
      }

      setVerified(true);
      setToast({ message: t("accessVerified"), type: "success" });
      setTimeout(() => {
        router.push("/portal/pedidos");
      }, 1000);
    } catch {
      setToast({ message: t("tokenVerifyError"), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-default-500">{t("clientDesc")}</p>

      <Input
        isRequired
        classNames={{
          inputWrapper: "bg-content1/70 border border-default-200/30",
        }}
        isDisabled={tokenSent && !verified}
        label={t("clientId")}
        placeholder={t("clientIdPlaceholder")}
        value={clientCode}
        onChange={(e) => setClientCode(e.target.value)}
      />

      {!tokenSent ? (
        <Button
          className="w-full font-semibold uppercase tracking-[0.15em]"
          color="primary"
          isDisabled={loading || remainingSeconds > 0 || !clientCode.trim()}
          isLoading={loading}
          onPress={requestToken}
        >
          {remainingSeconds > 0
            ? t("resendCodeIn", { seconds: remainingSeconds })
            : t("sendCode")}
        </Button>
      ) : null}

      {tokenSent && !verified ? (
        <div className="space-y-3">
          <p className="text-sm text-default-600">{t("enterOtpCode")}</p>
          <OtpInput
            focusOnMount
            length={6}
            value={otp}
            onValueChange={setOtp}
          />
          <Button
            className="w-full font-semibold uppercase tracking-[0.15em]"
            color="primary"
            isDisabled={loading || otp.length !== 6}
            isLoading={loading}
            onPress={verifyToken}
          >
            {t("verifyCode")}
          </Button>
          <Button
            className="w-full"
            isDisabled={loading || remainingSeconds > 0}
            size="sm"
            variant="light"
            onPress={() => {
              setTokenSent(false);
              setOtp("");
            }}
          >
            {remainingSeconds > 0
              ? t("resendIn", { seconds: remainingSeconds })
              : t("sendNewCode")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
