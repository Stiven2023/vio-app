import { validatePassword } from "@/src/utils/password-validator";

export function validateUserRegister({
  email,
  password,
}: {
  email: string;
  password: string;
}): string {
  if (!email) return "El correo es obligatorio.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return "Correo inválido.";
  
  const passwordError = validatePassword(password);
  if (passwordError) return passwordError;

  return "";
}

export function validateEmployeeRegister({
  name,
  email,
  position,
}: {
  name: string;
  email: string;
  position: string;
}): string {
  if (!name) return "El nombre es obligatorio.";
  if (!email) return "El correo es obligatorio.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Correo inválido.";
  if (!position) return "El puesto es obligatorio.";

  return "";
}

export function validateLogin({
  email,
  password,
}: {
  email: string;
  password: string;
}): string {
  if (!email) return "El usuario/correo es obligatorio.";
  const value = String(email ?? "").trim();

  if (value.includes("@") && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) {
    return "Correo inválido.";
  }
  if (!password) return "La contraseña es obligatoria.";

  return "";
}
