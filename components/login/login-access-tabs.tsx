"use client";

import { ChangeEvent, FormEvent } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  BsEyeFill,
  BsEyeSlashFill,
  BsPersonFill,
} from "react-icons/bs";
import { useTranslations } from "next-intl";

import { ExternalAccessTab } from "@/components/login/external-access-tab";

type FormState = {
  username: string;
  password: string;
};

type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

export function LoginAccessTabs({
  selected,
  setSelected,
  staffForm,
  thirdPartyForm,
  onStaffFormChange,
  onThirdPartyFormChange,
  loading,
  showStaffPassword,
  showThirdPartyPassword,
  toggleShowStaffPassword,
  toggleShowThirdPartyPassword,
  onSubmitViomar,
  onSubmitThirdParty,
  onOpenResetRequest,
  setLoading,
  setToast,
}: {
  selected: string;
  setSelected: (next: string) => void;
  staffForm: FormState;
  thirdPartyForm: FormState;
  onStaffFormChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onThirdPartyFormChange: (e: ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  showStaffPassword: boolean;
  showThirdPartyPassword: boolean;
  toggleShowStaffPassword: () => void;
  toggleShowThirdPartyPassword: () => void;
  onSubmitViomar: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitThirdParty: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenResetRequest: () => void;
  setLoading: (next: boolean) => void;
  setToast: (toast: ToastState | null) => void;
}) {
  const t = useTranslations("Auth");

  const tabButtonClass = (key: string) =>
    [
      "rounded-none border-b-2 px-2 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] sm:px-3 sm:text-xs sm:tracking-[0.15em]",
      selected === key
        ? "border-[var(--viomar-primary)] text-[var(--viomar-primary)]"
        : "border-transparent text-[#8A93A3]",
    ].join(" ");

  return (
    <div className="space-y-4">
      <div
        aria-label="Access types"
        className="flex overflow-x-auto whitespace-nowrap border-b border-default-200/30"
        role="tablist"
      >
        <button
          aria-selected={selected === "viomar"}
          className={tabButtonClass("viomar")}
          role="tab"
          type="button"
          onClick={() => setSelected("viomar")}
        >
          {t("tabStaff")}
        </button>
        <button
          aria-selected={selected === "cliente"}
          className={tabButtonClass("cliente")}
          role="tab"
          type="button"
          onClick={() => setSelected("cliente")}
        >
          {t("tabClient")}
        </button>
        <button
          aria-selected={selected === "tercero"}
          className={tabButtonClass("tercero")}
          role="tab"
          type="button"
          onClick={() => setSelected("tercero")}
        >
          {t("tabThirdParty")}
        </button>
      </div>

      {selected === "viomar" ? (
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => void onSubmitViomar(e)}
        >
          <p className="text-xs text-default-500">{t("staffDesc")}</p>
          <div className="space-y-3">
            <Input
              required
              autoComplete="username"
              classNames={{
                inputWrapper: "bg-content1/70 border border-default-200/30",
              }}
              label={t("username")}
              name="username"
              startContent={
                <BsPersonFill className="text-xl text-default-500" />
              }
              value={staffForm.username}
              onChange={onStaffFormChange}
            />
            <Input
              required
              autoComplete="current-password"
              classNames={{
                inputWrapper: "bg-content1/70 border border-default-200/30",
              }}
              endContent={
                <Button
                  aria-label={showStaffPassword ? t("hidePassword") : t("showPassword")}
                  className="min-w-10 px-0"
                  size="sm"
                  type="button"
                  variant="light"
                  onPress={toggleShowStaffPassword}
                >
                  {showStaffPassword ? (
                    <BsEyeSlashFill className="text-lg" />
                  ) : (
                    <BsEyeFill className="text-lg" />
                  )}
                </Button>
              }
              label={t("password")}
              name="password"
              type={showStaffPassword ? "text" : "password"}
              value={staffForm.password}
              onChange={onStaffFormChange}
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
              {t("signIn")}
            </Button>

            <Button
              className="w-full"
              isDisabled={loading}
              variant="light"
              onPress={onOpenResetRequest}
            >
              {t("forgotPassword")}
            </Button>
          </div>
        </form>
      ) : null}

      {selected === "cliente" ? (
        <div className="pt-2">
          <ExternalAccessTab
            audience="CLIENTE"
            loading={loading}
            setLoading={setLoading}
            setToast={setToast}
          />
        </div>
      ) : null}

      {selected === "tercero" ? (
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => void onSubmitThirdParty(e)}
        >
          <p className="text-xs text-default-500">{t("thirdPartyNote")}</p>
          <Input
            required
            autoComplete="username"
            classNames={{
              inputWrapper: "bg-content1/70 border border-default-200/30",
            }}
            label={t("username")}
            name="username"
            placeholder={t("thirdPartyUsernamePlaceholder")}
            startContent={
              <BsPersonFill className="text-xl text-default-500" />
            }
            value={thirdPartyForm.username}
            onChange={onThirdPartyFormChange}
          />
          <Input
            required
            autoComplete="current-password"
            classNames={{
              inputWrapper: "bg-content1/70 border border-default-200/30",
            }}
            endContent={
              <Button
                aria-label={showThirdPartyPassword ? t("hidePassword") : t("showPassword")}
                className="min-w-10 px-0"
                size="sm"
                type="button"
                variant="light"
                onPress={toggleShowThirdPartyPassword}
              >
                {showThirdPartyPassword ? (
                  <BsEyeSlashFill className="text-lg" />
                ) : (
                  <BsEyeFill className="text-lg" />
                )}
              </Button>
            }
            label={t("password")}
            name="password"
            type={showThirdPartyPassword ? "text" : "password"}
            value={thirdPartyForm.password}
            onChange={onThirdPartyFormChange}
          />
          <Button
            className="w-full font-semibold uppercase tracking-[0.2em]"
            color="primary"
            isDisabled={loading}
            isLoading={loading}
            type="submit"
          >
            {t("signIn")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
