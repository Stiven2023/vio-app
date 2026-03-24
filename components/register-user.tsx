"use client";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";
import { useState } from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { BsEnvelopeFill, BsEyeFill, BsEyeSlashFill } from "react-icons/bs";

import { validateUserRegister } from "@/utils/validation";
import { AlertToast } from "@/components/alert-toast";
import {
  EmployeeRegisterForm,
  type InitialUser,
} from "@/components/employee-register-form";
import { OtpInput } from "@/components/otp-input";

export default function RegisterUser() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [createdUser, setCreatedUser] = useState<InitialUser | null>(null);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => validateUserRegister(form);

  const verifyEmail = async () => {
    const email = createdUser?.email?.trim() || form.email.trim();
    const token = otp.trim();

    if (!email) {
      setToast({ message: "Email is required.", type: "error" });

      return;
    }
    if (!/^[0-9]{6}$/.test(token)) {
      setToast({ message: "Enter a 6-digit code.", type: "error" });

      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/users/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({ message: text || "Invalid token.", type: "error" });

        return;
      }

      setToast({ message: "Email verified.", type: "success" });
      setOtpVisible(false);
      setEmployeeOpen(true);
    } catch {
      setToast({ message: "Could not verify email.", type: "error" });
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    const email = createdUser?.email?.trim() || form.email.trim();

    if (!email) {
      setToast({ message: "Email is required.", type: "error" });

      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/users/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({
          message: text || "Could not resend token.",
          type: "error",
        });

        return;
      }

      setToast({ message: "Token resent.", type: "success" });
    } catch {
      setToast({ message: "Could not resend token.", type: "error" });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validate();

    if (err) {
      setToast({ message: err, type: "error" });

      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({
          message: text || "Could not create user.",
          type: "error",
        });

        return;
      }

      const data = (await res.json()) as Array<{ id: string; email: string }>;
      const u = data?.[0];

      if (!u?.id) {
        setToast({
          message: "Invalid server response.",
          type: "error",
        });

        return;
      }

      setToast({
        message:
          // emailSent es opcional (compatibilidad)
          (u as any)?.emailSent === false
            ? "User created, but token could not be sent. Use Resend."
            : "User created. Verify the email with the token.",
        type: "success",
      });
      setCreatedUser({ id: u.id, email: u.email ?? form.email.trim() });
      setOtp("");
      setOtpVisible(true);
    } catch {
      setToast({ message: "Could not create user.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      {toast ? <AlertToast message={toast.message} type={toast.type} /> : null}
      <form onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-4">User Registration</h2>
        <Input
          required
          label="Email"
          name="email"
          startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
          type="email"
          value={form.email}
          onChange={handleChange}
        />
        <Input
          required
          endContent={
            <Button
              aria-label={showPassword ? "Hide password" : "Show password"}
              size="sm"
              type="button"
              variant="light"
              onPress={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <BsEyeSlashFill className="text-lg" />
              ) : (
                <BsEyeFill className="text-lg" />
              )}
            </Button>
          }
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={handleChange}
        />
        <Button
          className="mt-4 w-full"
          color="primary"
          disabled={loading}
          type="submit"
        >
          {loading ? <Skeleton className="w-6 h-6 mx-auto" /> : "Register"}
        </Button>
      </form>

      {otpVisible ? (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium">Verify your email</h3>
          <p className="text-sm text-default-500">
            We sent a 6-digit code to your email.
          </p>
          <div className="space-y-2">
            <div className="text-sm">Code (6 digits)</div>
            <OtpInput
              focusOnMount
              isDisabled={verifying}
              value={otp}
              onValueChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <div className="flex gap-2">
            <Button isDisabled={verifying} variant="flat" onPress={resendOtp}>
              Resend
            </Button>
            <Button
              color="primary"
              isDisabled={verifying}
              onPress={verifyEmail}
            >
              Verify
            </Button>
          </div>
        </div>
      ) : null}

      <Modal disableAnimation isOpen={employeeOpen} onOpenChange={setEmployeeOpen}>
        <ModalContent>
          <ModalHeader>Employee Registration</ModalHeader>
          <ModalBody>
            {createdUser ? (
              <EmployeeRegisterForm
                initialUser={createdUser}
                submitLabel="Create employee"
                onSuccess={() => setEmployeeOpen(false)}
              />
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setEmployeeOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
