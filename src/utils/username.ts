const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;

export const USERNAME_REQUIREMENTS = {
  maxLength: 32,
  minLength: 3,
  pattern: USERNAME_REGEX,
} as const;

export function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isValidUsername(value: unknown) {
  const username = normalizeUsername(value);

  return USERNAME_REGEX.test(username);
}

export function usernameValidationMessage() {
  return "El usuario debe tener entre 3 y 32 caracteres y solo usar letras, números, punto, guion o guion bajo.";
}

export function deriveUsernameFromEmail(email: string) {
  const [localPart = ""] = String(email ?? "")
    .trim()
    .toLowerCase()
    .split("@");

  const sanitized = localPart
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "");

  if (sanitized.length >= USERNAME_REQUIREMENTS.minLength) {
    return sanitized.slice(0, USERNAME_REQUIREMENTS.maxLength);
  }

  return "user";
}