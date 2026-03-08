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
      setToast({ message: "El ID del cliente es obligatorio.", type: "error" });

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
        const msg = typeof body?.message === "string" ? body.message : "No se pudo enviar el token.";
        if (body?.retryAt) setRetryAt(String(body.retryAt));
        setToast({ message: msg, type: "error" });

        return;
      }

      setRetryAt(typeof body?.retryAt === "string" ? body.retryAt : null);
      setTokenSent(true);
      setVerified(false);
      setOtp("");
      setToast({ message: "Token enviado al correo del cliente.", type: "success" });
    } catch {
      setToast({ message: "No se pudo enviar el token.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    if (!clientCode.trim() || otp.length !== 6) {
      setToast({ message: "Debes ingresar ID cliente y token de 6 dígitos.", type: "error" });

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
        setToast({ message: text || "Token inválido.", type: "error" });

        return;
      }

      setVerified(true);
      setToast({ message: "Acceso verificado por 1 día.", type: "success" });
    } catch {
      setToast({ message: "No se pudo verificar el token.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        isRequired
        label="ID cliente"
        placeholder="Ej: CN10001"
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
        {remainingSeconds > 0 ? `Solicitar token (${remainingSeconds}s)` : "Solicitar token"}
      </Button>

      {tokenSent ? (
        <div className="space-y-2">
          <p className="text-sm text-default-600">Ingresa el código OTP de 6 dígitos enviado al correo del cliente.</p>
          <OtpInput focusOnMount length={6} value={otp} onValueChange={setOtp} />
          <Button
            className="w-full"
            color="primary"
            isDisabled={loading || otp.length !== 6}
            isLoading={loading}
            onPress={verifyToken}
          >
            Validar token
          </Button>
        </div>
      ) : null}

      {verified ? (
        <div className="space-y-2 border border-default-200 rounded-medium p-3">
          <Input
            label="Código del pedido"
            placeholder="Ej: VN-1001"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
          />
          <Button
            className="w-full"
            color="primary"
            onPress={() => {
              const normalized = orderCode.trim().toUpperCase();
              router.push(normalized ? `/portal/pedidos?orderCode=${encodeURIComponent(normalized)}` : "/portal/pedidos");
            }}
          >
            Ingresar al portal
          </Button>
        </div>
      ) : null}
    </div>
  );
}
