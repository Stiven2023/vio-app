"use client";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BsEnvelopeFill,
  BsEyeFill,
  BsEyeSlashFill,
} from "react-icons/bs";

import { validateLogin } from "@/utils/validation";
import { AlertToast } from "@/components/alert-toast";
import { useSessionStore } from "@/store/session";
import {
  RequestPasswordResetModal,
  ResetPasswordModal,
} from "@/components/password-reset";

export default function LoginUser() {
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

  return (
    <Card className="w-full max-w-md mx-auto mt-10 p-6">
      {toast && <AlertToast message={toast.message} type={toast.type} />}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Iniciar Sesión</h2>
          <p className="text-sm text-default-500">
            Ingresa tus credenciales para continuar.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            required
            autoComplete="email"
            label="Correo electrónico"
            name="email"
            startContent={
              <BsEnvelopeFill className="text-xl text-default-500" />
            }
            type="email"
            value={form.email}
            onChange={handleChange}
          />
          <Input
            required
            autoComplete="current-password"
            endContent={
              <Button
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Ver contraseña"
                }
                className="min-w-10 px-0"
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
