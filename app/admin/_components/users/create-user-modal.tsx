"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  BsEnvelopeFill,
  BsEyeFill,
  BsEyeSlashFill,
} from "react-icons/bs";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createUserSchema } from "../../_lib/schemas";

import { OtpInput } from "@/components/otp-input";

const OTP_TTL_MS = 15 * 60 * 1000;

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function CreateUserModal({
  isOpen,
  onOpenChange,
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationTicket, setEmailVerificationTicket] = useState<
    string | null
  >(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = useMemo(
    () => email.trim() !== "" && password.trim() !== "",
    [email, password],
  );

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(id);
  }, [expiresAt]);

  const reset = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setOtp("");
    setEmailVerified(false);
    setEmailVerificationTicket(null);
    setErrors({});
    setSubmitting(false);
    setSendingCode(false);
    setVerifying(false);
    setExpiresAt(null);
  };

  const effectiveEmail = email.trim().toLowerCase();
  const otpReady = /^[0-9]{6}$/.test(otp.trim());
  const countdown =
    expiresAt == null ? null : formatCountdown(Math.max(0, expiresAt - now));
  const busy = submitting || sendingCode || verifying;

  const submit = async () => {
    if (submitting) return;
    if (!emailVerified || !emailVerificationTicket) {
      toast.error("Primero verifica el email con el código");

      return;
    }

    const parsed = createUserSchema.safeParse({
      email: effectiveEmail,
      password,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues)
        next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);

      return;
    }
    setErrors({});
    try {
      setSubmitting(true);
      await apiJson(`/api/admin/users`, {
        method: "POST",
        body: JSON.stringify({
          ...parsed.data,
          emailVerificationTicket,
        }),
      });
      toast.success("Usuario creado");
      onOpenChange(false);
      onCreated();
      reset();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const sendCode = async () => {
    if (!effectiveEmail) {
      toast.error("El email es obligatorio");

      return;
    }
    if (sendingCode) return;

    try {
      setSendingCode(true);
      const res = await apiJson<{ expiresAt: number }>(
        "/api/admin/users/verify-email",
        {
          method: "POST",
          body: JSON.stringify({ email: effectiveEmail }),
        },
      );

      setOtp("");
      setExpiresAt(res?.expiresAt ?? Date.now() + OTP_TTL_MS);
      setEmailVerified(false);
      setEmailVerificationTicket(null);
      toast.success("Código enviado");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSendingCode(false);
    }
  };

  const verifyOtp = async () => {
    if (!effectiveEmail) {
      toast.error("El email es obligatorio");

      return;
    }
    const token = otp.trim();

    if (!/^[0-9]{6}$/.test(token)) {
      toast.error("Ingresa un código de 6 dígitos");

      return;
    }
    if (verifying) return;

    try {
      setVerifying(true);
      const res = await apiJson<{ ticket: string }>(
        "/api/admin/users/verify-email",
        {
          method: "PUT",
          body: JSON.stringify({ email: effectiveEmail, token }),
        },
      );

      if (!res?.ticket) {
        throw new Error("Respuesta inválida del servidor");
      }
      setEmailVerified(true);
      setEmailVerificationTicket(res.ticket);
      toast.success("Correo verificado");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && busy) return;
    if (!open) reset();
    onOpenChange(open);
  };

  return (
    <Modal
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
    >
      <ModalContent>
        <ModalHeader>Crear usuario</ModalHeader>
        <ModalBody>
          <Input
            errorMessage={errors.email}
            isInvalid={Boolean(errors.email)}
            label="Email"
            startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
            value={email}
            onValueChange={(v) => {
              setEmail(v);
              if (
                emailVerified ||
                emailVerificationTicket ||
                otp ||
                expiresAt
              ) {
                setEmailVerified(false);
                setEmailVerificationTicket(null);
                setOtp("");
                setExpiresAt(null);
              }
            }}
          />
          <div className="pt-2 space-y-3">
            <div className="text-sm text-default-600">
              ¿Verifica el email del user listo?
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                isDisabled={
                  !effectiveEmail ||
                  sendingCode ||
                  verifying ||
                  submitting ||
                  emailVerified
                }
                isLoading={sendingCode}
                variant="flat"
                onPress={sendCode}
              >
                Enviar código
              </Button>
              {countdown ? (
                <div className="text-xs text-default-500">
                  Expira en {countdown}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-sm">Código (6 dígitos)</div>
              <OtpInput
                isDisabled={verifying || submitting || emailVerified}
                value={otp}
                onValueChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
              />
            </div>

            <Button
              color="primary"
              isDisabled={!otpReady || verifying || submitting || emailVerified}
              isLoading={verifying}
              onPress={verifyOtp}
            >
              {emailVerified ? "Verificado" : "Verificar"}
            </Button>
          </div>

          {emailVerified ? (
            <Input
              endContent={
                <Button
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Ver contraseña"
                  }
                  isDisabled={submitting}
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
              errorMessage={errors.password}
              isInvalid={Boolean(errors.password)}
              label="Contraseña"
              type={showPassword ? "text" : "password"}
              value={password}
              onValueChange={setPassword}
            />
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={submitting || sendingCode || verifying}
            variant="flat"
            onPress={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            isDisabled={!canSubmit || submitting || !emailVerified}
            isLoading={submitting}
            onPress={submit}
          >
            Crear
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
