import { ChangeEvent, FormEvent } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tab, Tabs } from "@heroui/tabs";
import { BsEnvelopeFill, BsEyeFill, BsEyeSlashFill } from "react-icons/bs";

import { ExternalAccessTab } from "@/components/login/external-access-tab";

type FormState = {
  email: string;
  password: string;
};

type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

export function LoginAccessTabs({
  selected,
  setSelected,
  form,
  onFormChange,
  loading,
  showPassword,
  toggleShowPassword,
  onSubmitViomar,
  onSubmitThirdParty,
  onOpenResetRequest,
  setLoading,
  setToast,
}: {
  selected: string;
  setSelected: (next: string) => void;
  form: FormState;
  onFormChange: (e: ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  showPassword: boolean;
  toggleShowPassword: () => void;
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
        tabList: "rounded-none border-b border-default-200/30 bg-transparent p-0 gap-0 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
        tab: "rounded-none px-2 sm:px-3 min-w-max data-[selected=true]:text-[var(--viomar-primary)] data-[selected=true]:border-b-2 data-[selected=true]:border-[var(--viomar-primary)] text-[#8A93A3]",
        tabContent: "text-[10px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.15em] font-semibold",
        cursor: "hidden",
      }}
      selectedKey={selected}
      variant="underlined"
      onSelectionChange={(key) => setSelected(String(key))}
    >
      <Tab key="viomar" title="Viomar staff">
        <form className="space-y-4 pt-2" onSubmit={(e) => void onSubmitViomar(e)}>
          <div className="space-y-3">
            <Input
              required
              autoComplete="email"
              classNames={{ inputWrapper: "bg-content1/70 border border-default-200/30" }}
              label="Email address"
              name="email"
              startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
              type="email"
              value={form.email}
              onChange={onFormChange}
            />
            <Input
              required
              autoComplete="current-password"
              classNames={{ inputWrapper: "bg-content1/70 border border-default-200/30" }}
              endContent={
                <Button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="min-w-10 px-0"
                  size="sm"
                  type="button"
                  variant="light"
                  onPress={toggleShowPassword}
                >
                  {showPassword ? <BsEyeSlashFill className="text-lg" /> : <BsEyeFill className="text-lg" />}
                </Button>
              }
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={onFormChange}
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

      <Tab key="tercero" title="Third-party / courier">
        <form className="space-y-4 pt-2" onSubmit={(e) => void onSubmitThirdParty(e)}>
          <Input
            required
            autoComplete="username"
            classNames={{ inputWrapper: "bg-content1/70 border border-default-200/30" }}
            label="Username"
            placeholder="e.g. courier1, sewer2"
            name="email"
            value={form.email}
            onChange={onFormChange}
          />
          <Input
            required
            autoComplete="current-password"
            classNames={{ inputWrapper: "bg-content1/70 border border-default-200/30" }}
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            endContent={
              <Button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="min-w-10 px-0"
                size="sm"
                type="button"
                variant="light"
                onPress={toggleShowPassword}
              >
                {showPassword ? <BsEyeSlashFill className="text-lg" /> : <BsEyeFill className="text-lg" />}
              </Button>
            }
            value={form.password}
            onChange={onFormChange}
          />
          <Button className="w-full" color="primary" isDisabled={loading} isLoading={loading} type="submit">
            Sign in as third-party
          </Button>
        </form>
      </Tab>
    </Tabs>
  );
}
