"use client";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Tab, Tabs } from "@heroui/tabs";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BsEnvelopeFill, BsEyeFill, BsEyeSlashFill } from "react-icons/bs";

import { validateLogin } from "@/utils/validation";
import { AlertToast } from "@/components/alert-toast";
import { OtpInput } from "@/components/otp-input";
import { ThemeSwitch } from "@/components/theme-switch";
import { ViomarLogo } from "@/components/viomar-logo";
import { useSessionStore } from "@/store/session";
import {
  RequestPasswordResetModal,
  ResetPasswordModal,
} from "@/components/password-reset";

type ExternalAudience = "CLIENTE" | "TERCERO";

function JerseyIllustration() {
  return (
    <svg
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", maxWidth: 220, opacity: 0.24 }}
    >
      <path
        d="M55 35 L30 75 L60 80 L60 150 L140 150 L140 80 L170 75 L145 35 L122 50 C115 58 85 58 78 50 Z"
        stroke="var(--viomar-primary)"
        strokeWidth="2"
        fill="color-mix(in srgb, var(--viomar-primary) 10%, transparent)"
      />
      <path
        d="M78 50 C88 38 112 38 122 50"
        stroke="var(--viomar-primary)"
        strokeWidth="1.5"
        fill="none"
      />
      <line x1="60" y1="95" x2="140" y2="95" stroke="var(--viomar-primary)" strokeWidth="0.8" strokeDasharray="5 4" opacity="0.4" />
      <line x1="60" y1="118" x2="140" y2="118" stroke="var(--viomar-primary)" strokeWidth="0.8" strokeDasharray="5 4" opacity="0.25" />
      <circle cx="100" cy="112" r="10" stroke="var(--viomar-primary)" strokeWidth="1.2" fill="none" opacity="0.85" />
    </svg>
  );
}

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
          router.push("/");
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
          router.push("/erp/dashboard");
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
    <div className="min-h-screen bg-[var(--viomar-bg)] text-[var(--viomar-fg)]">
      {toast && <AlertToast message={toast.message} type={toast.type} />}

      <div className="fixed right-3 top-3 z-50 rounded-medium border border-white/10 bg-content1/70 p-1 backdrop-blur sm:right-5 sm:top-5">
        <ThemeSwitch />
      </div>

      <div className="grid min-h-screen lg:grid-cols-[42%_58%]">
        <motion.aside
          className="relative hidden overflow-hidden border-r border-default-200/30 bg-[color-mix(in_srgb,var(--viomar-bg)_92%,black_8%)] p-10 lg:flex lg:flex-col lg:justify-between"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_30%_60%,color-mix(in_srgb,var(--viomar-primary)_12%,transparent)_0%,transparent_70%)]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 gap-1 px-1 opacity-10">
            <div className="flex-1 -skew-x-[8deg] bg-[var(--viomar-primary)]" />
            <div className="flex-1 -skew-x-[8deg] bg-[var(--viomar-primary)]" />
            <div className="flex-1 -skew-x-[8deg] bg-[var(--viomar-primary)]" />
          </div>

          <div className="relative z-10 inline-flex flex-col items-center text-center">
            <ViomarLogo height={34} />
            <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--viomar-primary)]">
              Plataforma empresarial
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-7 text-center">
            <JerseyIllustration />
            <div className="flex flex-col items-center">
              <h2 className="text-4xl font-black leading-[1.02] tracking-tight text-[var(--viomar-fg)]">
                Todo tu negocio.
                <br />
                <span className="text-[var(--viomar-primary)]">Un solo lugar.</span>
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-default-500">
                ERP, MES y CRM integrados para equipos de operaciones, producción y gestión comercial.
              </p>
            </div>
          </div>

          <div className="relative z-10 text-[0.62rem] uppercase tracking-[0.18em] text-default-500">
            © {new Date().getFullYear()} Viomar
          </div>
        </motion.aside>

        <div className="flex items-center justify-center p-4 sm:p-6 lg:p-10">
          <motion.div
            className="w-full max-w-[580px]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
          >
            <Card className="border border-default-200/30 bg-[color-mix(in_srgb,var(--viomar-bg)_88%,black_12%)] p-4 sm:p-6 shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight text-[var(--viomar-fg)]">Iniciar sesión</h2>
                  <p className="text-sm text-default-500">Selecciona tu tipo de acceso.</p>
                </div>

                <Tabs
                  aria-label="Tipos de acceso"
                  classNames={{
                    tabList: "rounded-none border-b border-default-200/30 bg-transparent p-0 gap-0 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
                    tab: "rounded-none px-2 sm:px-3 min-w-max data-[selected=true]:text-[var(--viomar-primary)] data-[selected=true]:border-b-2 data-[selected=true]:border-[var(--viomar-primary)] text-[#8A93A3]",
                    tabContent: "text-[10px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.15em] font-semibold",
                    cursor: "hidden",
                  }}
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
                          classNames={{ inputWrapper: "bg-content1/70 border border-default-200/30" }}
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
                          classNames={{ inputWrapper: "bg-content1/70 border border-default-200/30" }}
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
                          className="w-full font-semibold uppercase tracking-[0.2em]"
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
                        classNames={{ inputWrapper: "bg-content1/70 border border-default-200/30" }}
                        label="Usuario"
                        placeholder="Ej: mensajero1, confeccionista2"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                      />
                      <Input
                        required
                        autoComplete="current-password"
                        classNames={{ inputWrapper: "bg-content1/70 border border-default-200/30" }}
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
            </Card>
          </motion.div>
        </div>
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
    </div>
  );
}
