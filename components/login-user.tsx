"use client";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Tab, Tabs } from "@heroui/tabs";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BsEnvelopeFill, BsEyeFill, BsEyeSlashFill } from "react-icons/bs";

import { validateLogin } from "@/utils/validation";
import { AlertToast } from "@/components/alert-toast";
import { OtpInput } from "@/components/otp-input";
import { useSessionStore } from "@/store/session";
import {
  RequestPasswordResetModal,
  ResetPasswordModal,
} from "@/components/password-reset";

type ExternalAudience = "CLIENTE" | "TERCERO";

function ExternalAccessTab({
  audience,
  loading,
  setLoading,
  setToast,
}: {
  audience: ExternalAudience;
  loading: boolean;
  setLoading: (next: boolean) => void;
  setToast: (toast: { message: string; type: "success" | "error" | "info" } | null) => void;
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

export default function LoginUser() {
  const [selected, setSelected] = useState("viomar");
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetRequestOpen, setResetRequestOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const router = useRouter();
  const login = useSessionStore((s) => s.login);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => validateLogin(form);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validate();

    if (err) {
      setToast({ message: err, type: "error" });

      return;
    }
    setLoading(true);
    try {
      const ok = await login(form.email, form.password);

      if (ok) {
        setToast({ message: "Inicio de sesión exitoso.", type: "success" });
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      } else {
        setToast({
          message: "Credenciales inválidas o usuario no encontrado.",
          type: "error",
        });
      }
    } catch {
      setToast({
        message:
          "No se pudo iniciar sesión. Verifica tus datos e intenta nuevamente.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleThirdPartySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      setToast({ message: "Usuario y contraseña son obligatorios.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const identifier = form.email.trim();
      const normalized = identifier.includes("@")
        ? identifier
        : identifier.toLowerCase().replace(/\s+/g, "") + "@terceros.viomar.local";

      const ok = await login(normalized, form.password);

      if (ok) {
        setToast({ message: "Inicio de sesión exitoso.", type: "success" });
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      } else {
        setToast({ message: "Credenciales inválidas.", type: "error" });
      }
    } catch {
      setToast({ message: "No se pudo iniciar sesión.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-10 p-6">
      {toast && <AlertToast message={toast.message} type={toast.type} />}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Iniciar Sesión</h2>
          <p className="text-sm text-default-500">Selecciona tu tipo de acceso.</p>
        </div>

        <Tabs
          aria-label="Tipos de acceso"
          selectedKey={selected}
          variant="underlined"
          onSelectionChange={(key) => setSelected(String(key))}
        >
          <Tab key="viomar" title="Soy Viomar">
            <form className="space-y-4 pt-2" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <Input
                  required
                  autoComplete="email"
                  label="Correo electrónico"
                  name="email"
                  startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                />
                <Input
                  required
                  autoComplete="current-password"
                  endContent={
                    <Button
                      aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                      className="min-w-10 px-0"
                      size="sm"
                      type="button"
                      variant="light"
                      onPress={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <BsEyeSlashFill className="text-lg" /> : <BsEyeFill className="text-lg" />}
                    </Button>
                  }
                  label="Contraseña"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2 pt-1">
                <Button
                  className="w-full"
                  color="primary"
                  isDisabled={loading}
                  isLoading={loading}
                  type="submit"
                >
                  Entrar
                </Button>

                <Button
                  className="w-full"
                  isDisabled={loading}
                  variant="light"
                  onPress={() => setResetRequestOpen(true)}
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              </div>
            </form>
          </Tab>
          <Tab key="cliente" title="Soy cliente">
            <div className="pt-2">
              <ExternalAccessTab
                audience="CLIENTE"
                loading={loading}
                setLoading={setLoading}
                setToast={setToast}
              />
            </div>
          </Tab>
          <Tab key="tercero" title="Soy tercero/mensajero">
            <form className="space-y-4 pt-2" onSubmit={handleThirdPartySubmit}>
              <Input
                required
                autoComplete="username"
                label="Usuario"
                placeholder="Ej: mensajero1, confeccionista2"
                name="email"
                value={form.email}
                onChange={handleChange}
              />
              <Input
                required
                autoComplete="current-password"
                label="Contraseña"
                name="password"
                type={showPassword ? "text" : "password"}
                endContent={
                  <Button
                    aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    className="min-w-10 px-0"
                    size="sm"
                    type="button"
                    variant="light"
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <BsEyeSlashFill className="text-lg" /> : <BsEyeFill className="text-lg" />}
                  </Button>
                }
                value={form.password}
                onChange={handleChange}
              />
              <Button className="w-full" color="primary" isDisabled={loading} isLoading={loading} type="submit">
                Entrar como tercero
              </Button>
            </form>
          </Tab>
        </Tabs>
      </div>

      <RequestPasswordResetModal
        isOpen={resetRequestOpen}
        onOpenChange={setResetRequestOpen}
        onSent={(email) => {
          setResetEmail(email);
          setResetRequestOpen(false);
          setResetOpen(true);
        }}
      />

      <ResetPasswordModal
        initialEmail={resetEmail}
        isOpen={resetOpen}
        onOpenChange={setResetOpen}
      />
    </Card>
  );
}
