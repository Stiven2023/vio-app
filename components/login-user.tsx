"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/card";
import { Button } from "@heroui/button";
import { useTranslations } from "next-intl";

import { validateLogin } from "@/utils/validation";
import { ModuleLogo } from "@/components/module-logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { ViomarLogo } from "@/components/viomar-logo";
import { useSessionStore } from "@/store/session";
import { Role } from "@/src/db/enums";
import { getEffectiveSessionRole } from "@/src/utils/session-role";
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

type SupportedLocale = "en" | "es";

// Roles that belong to the production floor — redirect to MES after login
const MES_ROLES = new Set<string>([
  Role.CONFECCIONISTA,
  Role.EMPAQUE,
  Role.OPERARIO,
  Role.LIDER_OPERACIONAL,
  Role.OPERARIO_INTEGRACION_CALIDAD,
  Role.OPERARIO_DESPACHO,
  Role.PROGRAMACION,
]);

function resolvePostLoginPath(role: string | null | undefined): string {
  if (!role) return "/";
  if (MES_ROLES.has(role.toUpperCase())) return "/mes";

  return "/";
}

export default function LoginUser() {
  const t = useTranslations("Auth");
  const [selected, setSelected] = useState("viomar");
  const [staffForm, setStaffForm] = useState({ username: "", password: "" });
  const [thirdPartyForm, setThirdPartyForm] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [showThirdPartyPassword, setShowThirdPartyPassword] = useState(false);
  const [resetRequestOpen, setResetRequestOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>("en");

  const router = useRouter();
  const login = useSessionStore((s) => s.login);
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    const stored = window.localStorage.getItem("preferredLanguage");
    const cookie = document.cookie
      .split("; ")
      .find((r) => r.startsWith("NEXT_LOCALE="))
      ?.split("=")[1];
    const locale = stored === "es" || cookie === "es" ? "es" : "en";

    setCurrentLocale(locale);
  }, []);

  const handleLocaleToggle = () => {
    const next: SupportedLocale = currentLocale === "en" ? "es" : "en";

    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    window.localStorage.setItem("preferredLanguage", next);
    window.sessionStorage.setItem("preferredLanguage", next);
    window.location.reload();
  };

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
        const role = getEffectiveSessionRole(useSessionStore.getState().user);
        const destination = resolvePostLoginPath(role);

        router.replace(destination);
        router.refresh();
      } else {
        setToast({ message: t("invalidCredentials"), type: "error" });
      }
    } catch {
      setToast({ message: t("signInError"), type: "error" });
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
      const ok = await login(
        thirdPartyForm.username.trim(),
        thirdPartyForm.password,
      );

      if (ok) {
        const role = getEffectiveSessionRole(useSessionStore.getState().user);

        if (
          String(role ?? "")
            .trim()
            .toUpperCase() !== Role.CONFECCIONISTA
        ) {
          await clearSession();
          setToast({ message: t("thirdPartyRestricted"), type: "error" });

          return;
        }

        const destination = resolvePostLoginPath(role);

        router.replace(destination);
        router.refresh();
      } else {
        setToast({ message: t("invalidCredentials"), type: "error" });
      }
    } catch {
      setToast({ message: t("signInError"), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--viomar-bg)] text-[var(--viomar-fg)]">
      <div className="fixed right-3 top-3 z-50 flex items-center gap-1 rounded-medium border border-white/10 bg-content1/70 p-1 backdrop-blur sm:right-5 sm:top-5">
        <Button
          className="min-w-12 text-xs font-semibold"
          size="sm"
          variant="light"
          onPress={handleLocaleToggle}
        >
          {currentLocale === "en" ? "ESP" : "ENG"}
        </Button>
        <ThemeSwitch />
      </div>

      <div className="grid min-h-screen lg:grid-cols-[42%_58%]">
        <aside className="relative hidden overflow-hidden border-r border-default-200/30 bg-[color-mix(in_srgb,var(--viomar-bg)_92%,black_8%)] p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_30%_60%,color-mix(in_srgb,var(--viomar-primary)_12%,transparent)_0%,transparent_70%)]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 gap-1 px-1 opacity-10">
            <div className="flex-1 -skew-x-[8deg] bg-[var(--viomar-primary)]" />
            <div className="flex-1 -skew-x-[8deg] bg-[var(--viomar-primary)]" />
            <div className="flex-1 -skew-x-[8deg] bg-[var(--viomar-primary)]" />
          </div>

          <div className="relative z-10 inline-flex flex-col items-center text-center">
            <ViomarLogo height={34} />
            <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--viomar-primary)]">
              {t("enterprisePlatform")}
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-7 text-center">
            <JerseyIllustration />
            <div className="flex flex-col items-center">
              <h2 className="text-4xl font-black leading-[1.02] tracking-tight text-[var(--viomar-fg)]">
                {t("taglineMain")}
                <br />
                <span className="text-[var(--viomar-primary)]">
                  {t("taglineAccent")}
                </span>
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-default-500">
                {t("taglineDesc")}
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
                    {t("signIn")}
                  </h2>
                  <p className="text-sm text-default-500">
                    {t("accessTypeSubtitle")}
                  </p>
                </div>

                {toast ? (
                  <div
                    aria-live="polite"
                    className={
                      toast.type === "error"
                        ? "rounded-medium border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                        : toast.type === "success"
                          ? "rounded-medium border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                          : "rounded-medium border border-default-200/50 bg-content1/40 px-3 py-2 text-sm text-default-600"
                    }
                    role="status"
                  >
                    {toast.message}
                  </div>
                ) : null}

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
                  toggleShowStaffPassword={() =>
                    setShowStaffPassword((v) => !v)
                  }
                  toggleShowThirdPartyPassword={() =>
                    setShowThirdPartyPassword((v) => !v)
                  }
                  onOpenResetRequest={() => setResetRequestOpen(true)}
                  onStaffFormChange={handleStaffChange}
                  onSubmitThirdParty={handleThirdPartySubmit}
                  onSubmitViomar={handleSubmit}
                  onThirdPartyFormChange={handleThirdPartyChange}
                />

                <div className="rounded-medium border border-default-200/40 bg-content1/30 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-default-500">
                    {t("mesLoginTitle")}
                  </p>
                  <p className="mt-1 text-sm text-default-500">
                    {t("mesLoginDesc")}
                  </p>
                  <Button
                    as={Link}
                    className="mt-3"
                    href="/mes/login"
                    variant="flat"
                  >
                    {t("mesLoginButton")}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {resetRequestOpen ? (
        <RequestPasswordResetModal
          isOpen={resetRequestOpen}
          onOpenChange={setResetRequestOpen}
          onSent={(email) => {
            setResetEmail(email);
            setResetRequestOpen(false);
            setResetOpen(true);
          }}
        />
      ) : null}

      {resetOpen ? (
        <ResetPasswordModal
          initialEmail={resetEmail}
          isOpen={resetOpen}
          onOpenChange={setResetOpen}
        />
      ) : null}
    </div>
  );
}
