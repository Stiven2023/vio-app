"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@heroui/card";

import { validateLogin } from "@/utils/validation";
import { AlertToast } from "@/components/alert-toast";
import { ThemeSwitch } from "@/components/theme-switch";
import { ViomarLogo } from "@/components/viomar-logo";
import { useSessionStore } from "@/store/session";
import {
  RequestPasswordResetModal,
  ResetPasswordModal,
} from "@/components/password-reset";
import { JerseyIllustration } from "@/components/login/jersey-illustration";
import { LoginAccessTabs } from "@/components/login/login-access-tabs";

type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

export default function LoginUser() {
  const [selected, setSelected] = useState("viomar");
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetRequestOpen, setResetRequestOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const [toast, setToast] = useState<ToastState | null>(null);

  const router = useRouter();
  const login = useSessionStore((s) => s.login);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => validateLogin(form);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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

  const handleThirdPartySubmit = async (e: FormEvent<HTMLFormElement>) => {
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
      {toast ? <AlertToast message={toast.message} type={toast.type} /> : null}

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

                <LoginAccessTabs
                  form={form}
                  loading={loading}
                  onFormChange={handleChange}
                  onOpenResetRequest={() => setResetRequestOpen(true)}
                  onSubmitThirdParty={handleThirdPartySubmit}
                  onSubmitViomar={handleSubmit}
                  selected={selected}
                  setLoading={setLoading}
                  setSelected={setSelected}
                  setToast={setToast}
                  showPassword={showPassword}
                  toggleShowPassword={() => setShowPassword((v) => !v)}
                />
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