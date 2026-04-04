export const LEGACY_MIGRATED_ROLE_PREFIX = "LEGACY_MIGRATED_ROLE_";

export function isLegacyMigratedRole(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .startsWith(LEGACY_MIGRATED_ROLE_PREFIX);
}