import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

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
      setToast({ message: "Client ID is required.", type: "error" });

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
          typeof body?.message === "string"
            ? body.message
            : "Could not send the token.";

        if (body?.retryAt) setRetryAt(String(body.retryAt));
        setToast({ message: msg, type: "error" });

        return;
      }

      setRetryAt(typeof body?.retryAt === "string" ? body.retryAt : null);
      setTokenSent(true);
      setVerified(false);
      setOtp("");
      setToast({
        message: "Token sent to the client's email.",
        type: "success",
      });
    } catch {
      setToast({ message: "Could not send the token.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    if (!clientCode.trim() || otp.length !== 6) {
      setToast({
        message: "Enter client ID and a 6-digit token.",
        type: "error",
      });

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

        setToast({ message: text || "Invalid token.", type: "error" });

        return;
      }

      setVerified(true);
      setToast({ message: "Access verified. Redirecting...", type: "success" });
      setTimeout(() => {
        router.push("/portal/pedidos");
      }, 1000);
    } catch {
      setToast({ message: "Could not verify the token.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-default-500">
        Enter your client ID and we will send a one-time code to your registered email.
      </p>

      <Input
        isRequired
        classNames={{
          inputWrapper: "bg-content1/70 border border-default-200/30",
        }}
        isDisabled={tokenSent && !verified}
        label="Client ID"
        placeholder="e.g. CN10001"
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
            ? `Resend code in ${remainingSeconds}s`
            : "Send access code"}
        </Button>
      ) : null}

      {tokenSent && !verified ? (
        <div className="space-y-3">
          <p className="text-sm text-default-600">
            Enter the 6-digit code sent to your email.
          </p>
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
            Verify code
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
              ? `Resend in ${remainingSeconds}s`
              : "Send new code"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
