import { ChangeEvent, FormEvent } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tab, Tabs } from "@heroui/tabs";
import {
  BsEyeFill,
  BsEyeSlashFill,
  BsPersonFill,
} from "react-icons/bs";

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
  return (
    <Tabs
      aria-label="Access types"
      classNames={{
        tabList:
          "rounded-none border-b border-default-200/30 bg-transparent p-0 gap-0 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
        tab: "rounded-none px-2 sm:px-3 min-w-max data-[selected=true]:text-[var(--viomar-primary)] data-[selected=true]:border-b-2 data-[selected=true]:border-[var(--viomar-primary)] text-[#8A93A3]",
        tabContent:
          "text-[10px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.15em] font-semibold",
        cursor: "hidden",
      }}
      selectedKey={selected}
      variant="underlined"
      onSelectionChange={(key) => setSelected(String(key))}
    >
      {/* ── Tab 1: Viomar Staff ── */}
      <Tab key="viomar" title="Viomar staff">
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => void onSubmitViomar(e)}
        >
          <p className="text-xs text-default-500">
            Internal Viomar employees. Use your assigned username and password.
          </p>
          <div className="space-y-3">
            <Input
              required
              autoComplete="username"
              classNames={{
                inputWrapper: "bg-content1/70 border border-default-200/30",
              }}
              label="Username"
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
                  aria-label={showStaffPassword ? "Hide password" : "Show password"}
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
              label="Password"
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
              Sign in
            </Button>

            <Button
              className="w-full"
              isDisabled={loading}
              variant="light"
              onPress={onOpenResetRequest}
            >
              Forgot your password?
            </Button>
          </div>
        </form>
      </Tab>

      {/* ── Tab 2: Client (OTP) ── */}
      <Tab key="cliente" title="I'm a client">
        <div className="pt-2">
          <ExternalAccessTab
            audience="CLIENTE"
            loading={loading}
            setLoading={setLoading}
            setToast={setToast}
          />
        </div>
      </Tab>

      {/* ── Tab 3: Third-party (confeccionistas) ── */}
      <Tab key="tercero" title="Third-party">
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => void onSubmitThirdParty(e)}
        >
          <p className="text-xs text-default-500">
            For <strong>confectionists</strong> only. Use the credentials provided by Viomar
            to enter MES and report reception or completion.
          </p>
          <Input
            required
            autoComplete="username"
            classNames={{
              inputWrapper: "bg-content1/70 border border-default-200/30",
            }}
            label="Username"
            name="username"
            placeholder="e.g. confeccionista1"
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
                aria-label={showThirdPartyPassword ? "Hide password" : "Show password"}
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
            label="Password"
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
            Sign in
          </Button>
        </form>
      </Tab>
    </Tabs>
  );
}
