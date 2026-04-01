import { validatePassword } from "@/src/utils/password-validator";
import {
  isValidUsername,
  usernameValidationMessage,
} from "@/src/utils/username";

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
  username,
  password,
}: {
  username: string;
  password: string;
}): string {
  if (!username) return "El usuario es obligatorio.";
  if (!isValidUsername(username)) return usernameValidationMessage();
  if (!password) return "La contraseña es obligatoria.";

  return "";
}
