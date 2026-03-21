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
  const [orderCode, setOrderCode] = useState("");
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
      setToast({ message: "Access verified for 1 day.", type: "success" });
    } catch {
      setToast({ message: "Could not verify the token.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        isRequired
        label="Client ID"
        placeholder="e.g. CN10001"
        value={clientCode}
        onChange={(e) => setClientCode(e.target.value)}
      />

      <Button
        className="w-full"
        isDisabled={loading || remainingSeconds > 0}
        isLoading={loading}
        variant="flat"
        onPress={requestToken}
      >
        {remainingSeconds > 0
          ? `Request token (${remainingSeconds}s)`
          : "Request token"}
      </Button>

      {tokenSent ? (
        <div className="space-y-2">
          <p className="text-sm text-default-600">
            Enter the 6-digit OTP code sent to the client's email.
          </p>
          <OtpInput
            focusOnMount
            length={6}
            value={otp}
            onValueChange={setOtp}
          />
          <Button
            className="w-full"
            color="primary"
            isDisabled={loading || otp.length !== 6}
            isLoading={loading}
            onPress={verifyToken}
          >
            Verify token
          </Button>
        </div>
      ) : null}

      {verified ? (
        <div className="space-y-2 border border-default-200 rounded-medium p-3">
          <Input
            label="Order code"
            placeholder="e.g. VN-1001"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
          />
          <Button
            className="w-full"
            color="primary"
            onPress={() => {
              const normalized = orderCode.trim().toUpperCase();

              router.push(
                normalized
                  ? `/portal/pedidos?orderCode=${encodeURIComponent(normalized)}`
                  : "/portal/pedidos",
              );
            }}
          >
            Enter portal
          </Button>
        </div>
      ) : null}
    </div>
  );
}
