"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/card";

import { validateLogin } from "@/utils/validation";
import { AlertToast } from "@/components/alert-toast";
import { ModuleLogo } from "@/components/module-logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { ViomarLogo } from "@/components/viomar-logo";
import { useSessionStore } from "@/store/session";
import { Role } from "@/src/db/enums";
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

// Roles that belong to the production floor — redirect to MES after login
const MES_ROLES = new Set<string>([
  Role.CONFECCIONISTA,
  Role.EMPAQUE,
  Role.OPERARIO,
  Role.LIDER_OPERACIONAL,
  Role.OPERARIO_INTEGRACION_CALIDAD,
  Role.OPERARIO_DESPACHO,
  Role.PROGRAMACION,
  "MENSAJERO", // Not in Role enum yet — kept as string
]);

function resolvePostLoginPath(role: string | null | undefined): string {
  if (!role) return "/";
  if (MES_ROLES.has(role.toUpperCase())) return "/mes";
  return "/";
}

export default function LoginUser() {
  const [selected, setSelected] = useState("viomar");
  const [staffForm, setStaffForm] = useState({ username: "", password: "" });
  const [thirdPartyForm, setThirdPartyForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [showThirdPartyPassword, setShowThirdPartyPassword] = useState(false);
  const [resetRequestOpen, setResetRequestOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const [toast, setToast] = useState<ToastState | null>(null);

  const router = useRouter();
  const login = useSessionStore((s) => s.login);

  const handleStaffChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStaffForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleThirdPartyChange = (e: ChangeEvent<HTMLInputElement>) => {
    setThirdPartyForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateLogin(staffForm);

    if (err) {
      setToast({ message: err, type: "error" });

      return;
    }

    setLoading(true);
    try {
      const ok = await login(staffForm.username, staffForm.password);

      if (ok) {
        setToast({ message: "Login successful.", type: "success" });
        setTimeout(() => {
          router.push("/");
        }, 1000);
      } else {
        setToast({
          message: "Invalid credentials or user not found.",
          type: "error",
        });
      }
    } catch {
      setToast({
        message: "Could not sign in. Please check your credentials and try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleThirdPartySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateLogin(thirdPartyForm);

    if (err) {
      setToast({ message: err, type: "error" });

      return;
    }

    setLoading(true);
    try {
      const ok = await login(thirdPartyForm.username.trim(), thirdPartyForm.password);

      if (ok) {
        setToast({ message: "Login successful.", type: "success" });
        // Read role from store (set by login()) to determine where to redirect
        const role = useSessionStore.getState().user?.role;
        const destination = resolvePostLoginPath(role);

        setTimeout(() => {
          router.push(destination);
        }, 1000);
      } else {
        setToast({ message: "Invalid credentials.", type: "error" });
      }
    } catch {
      setToast({ message: "Could not sign in.", type: "error" });
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
        <aside
          className="relative hidden overflow-hidden border-r border-default-200/30 bg-[color-mix(in_srgb,var(--viomar-bg)_92%,black_8%)] p-10 lg:flex lg:flex-col lg:justify-between"
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
              Enterprise platform
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-7 text-center">
            <JerseyIllustration />
            <div className="flex flex-col items-center">
              <h2 className="text-4xl font-black leading-[1.02] tracking-tight text-[var(--viomar-fg)]">
                Your business.
                <br />
                <span className="text-[var(--viomar-primary)]">
                  All in one place.
                </span>
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-default-500">
                Integrated ERP, MES and CRM for ops, production and commercial
                management.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-2">
                  <ModuleLogo active module="erp" size={78} />
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-default-500">
                    ERP
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <ModuleLogo active module="mes" size={78} />
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-default-500">
                    MES
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <ModuleLogo active module="crm" size={78} />
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-default-500">
                    CRM
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-[0.62rem] uppercase tracking-[0.18em] text-default-500">
            © {new Date().getFullYear()} Viomar
          </div>
        </aside>

        <div className="flex items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="w-full max-w-[580px]">
            <Card className="border border-default-200/30 bg-[color-mix(in_srgb,var(--viomar-bg)_88%,black_12%)] p-4 sm:p-6 shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight text-[var(--viomar-fg)]">
                    Sign in
                  </h2>
                  <p className="text-sm text-default-500">
                    Select your access type.
                  </p>
                </div>

                <LoginAccessTabs
                  loading={loading}
                  selected={selected}
                  setLoading={setLoading}
                  setSelected={setSelected}
                  setToast={setToast}
                  showStaffPassword={showStaffPassword}
                  showThirdPartyPassword={showThirdPartyPassword}
                  staffForm={staffForm}
                  thirdPartyForm={thirdPartyForm}
                  toggleShowStaffPassword={() => setShowStaffPassword((v) => !v)}
                  toggleShowThirdPartyPassword={() => setShowThirdPartyPassword((v) => !v)}
                  onOpenResetRequest={() => setResetRequestOpen(true)}
                  onStaffFormChange={handleStaffChange}
                  onSubmitThirdParty={handleThirdPartySubmit}
                  onSubmitViomar={handleSubmit}
                  onThirdPartyFormChange={handleThirdPartyChange}
                />
              </div>
            </Card>
          </div>
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
