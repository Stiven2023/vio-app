"use client";

import type {
  AdminUser,
  AdminUserOption,
  Paginated,
  Permission,
  Role,
} from "../_lib/types";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { apiJson, getErrorMessage } from "../_lib/api";

export function useReferenceData() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<AdminUserOption[]>([]);

  const roleNameById = useMemo(
    () => new Map(roles.map((r) => [r.id, r.name])),
    [roles],
  );
  const permNameById = useMemo(
    () => new Map(permissions.map((p) => [p.id, p.name])),
    [permissions],
  );

  const refresh = useCallback(async () => {
    try {
      const [rolesRes, permsRes, usersRes] = await Promise.all([
        apiJson<Paginated<Role>>(`/api/roles?page=1&pageSize=300`),
        apiJson<Paginated<Permission>>(`/api/permissions?page=1&pageSize=800`),
        apiJson<Paginated<AdminUser>>(`/api/admin/users?page=1&pageSize=200`),
      ]);

      setRoles(rolesRes.items);
      setPermissions(permsRes.items);
      setUsers(usersRes.items.map((u) => ({ id: u.id, email: u.email })));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { roles, permissions, users, roleNameById, permNameById, refresh };
}
