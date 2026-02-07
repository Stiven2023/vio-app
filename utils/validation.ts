export function validateUserRegister({
  email,
  password,
}: {
  email: string;
  password: string;
}): string {
  if (!email) return "El correo es obligatorio.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Correo inválido.";
  if (!password) return "La contraseña es obligatoria.";
  if (password.length < 6)
    return "La contraseña debe tener al menos 6 caracteres.";

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
  if (!email) return "El correo es obligatorio.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Correo inválido.";
  if (!password) return "La contraseña es obligatoria.";

  return "";
}
