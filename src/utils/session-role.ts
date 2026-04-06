import type { User } from "@/store/session";

export function getEffectiveSessionRole(user: User | null | undefined) {
  const mesRole = user?.mesAccess?.role;

  if (typeof mesRole === "string" && mesRole.trim() !== "") {
    return mesRole.trim();
  }

  const role = user?.role;

  return typeof role === "string" && role.trim() !== "" ? role.trim() : null;
}