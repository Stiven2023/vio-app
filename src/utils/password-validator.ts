/**
 * Centralized Password Validation
 * Single source of truth for password requirements across the application
 * Used by: utils/validation.ts, app/api/users/route.ts, app/erp/admin/_lib/schemas.ts
 */

export const PASSWORD_REQUIREMENTS = {
  minLength: 7,
  requireUppercase: true,
  allowedCharactersRegex: /^[A-Za-z0-9.*]+$/,
  allowedCharactersDescription: "letters, numbers, . and *",
};

/**
 * Validate password against requirements
 * @returns error message if invalid, null if valid
 */
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required";

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return `Password must have at least ${PASSWORD_REQUIREMENTS.minLength} characters`;
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!PASSWORD_REQUIREMENTS.allowedCharactersRegex.test(password)) {
    return `Password can only contain ${PASSWORD_REQUIREMENTS.allowedCharactersDescription}`;
  }

  return null;
}

/**
 * For use in Zod schemas where we need to validate inline
 */
export const passwordSchema = (message = "Invalid password") => ({
  test: (password: string) => {
    const error = validatePassword(password);
    return !error;
  },
  message,
});
