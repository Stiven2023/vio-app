"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { BsPersonFill } from "react-icons/bs";

import { AlertToast } from "@/components/alert-toast";

type RoleOption = { id: string; name: string };

export type InitialUser = { id: string; email: string };

type FormState = {
  userId: string;
  name: string;
  roleId: string;
  isActive: boolean;
};

export function EmployeeRegisterForm({
  initialUser,
  onSuccess,
  submitLabel = "Registrar",
}: {
  initialUser?: InitialUser;
  onSuccess?: () => void;
  submitLabel?: string;
}) {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [form, setForm] = useState<FormState>({
    userId: initialUser?.id ?? "",
    name: "",
    roleId: "",
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    setForm((s) => ({ ...s, userId: initialUser?.id ?? s.userId }));
  }, [initialUser]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingRoles(true);
      try {
        const res = await fetch("/api/roles?page=1&pageSize=100", {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();

          if (!cancelled) {
            setToast({
              message: text || "No se pudieron cargar los roles.",
              type: "error",
            });
            setRoles([]);
          }

          return;
        }

        const data = (await res.json()) as { items?: RoleOption[] };

        if (!cancelled) setRoles(data.items ?? []);
      } catch {
        if (!cancelled)
          setToast({
            message: "No se pudieron cargar los roles.",
            type: "error",
          });
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const canEditUserId = useMemo(() => !initialUser, [initialUser]);

  const submit = async () => {
    if (!form.userId.trim()) {
      setToast({ message: "El userId es obligatorio.", type: "error" });

      return;
    }
    if (!form.name.trim()) {
      setToast({ message: "El nombre es obligatorio.", type: "error" });

      return;
    }
    if (!form.roleId.trim()) {
      setToast({ message: "El rol es obligatorio.", type: "error" });

      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: form.userId.trim(),
          name: form.name.trim(),
          roleId: form.roleId,
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({
          message: text || "No se pudo registrar el empleado.",
          type: "error",
        });

        return;
      }

      setToast({ message: "Empleado registrado.", type: "success" });
      onSuccess?.();
    } catch {
      setToast({ message: "No se pudo registrar el empleado.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {toast ? <AlertToast message={toast.message} type={toast.type} /> : null}

      {initialUser ? (
        <Input isDisabled label="Usuario" value={initialUser.email} />
      ) : (
        <Input
          isDisabled={!canEditUserId || loading}
          label="User ID"
          value={form.userId}
          onValueChange={(v) => setForm((s) => ({ ...s, userId: v }))}
        />
      )}

      <Input
        isDisabled={loading}
        label="Nombre"
        startContent={<BsPersonFill className="text-xl text-default-500" />}
        value={form.name}
        onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
      />

      <Select
        isDisabled={loading || loadingRoles}
        label="Rol"
        selectedKeys={form.roleId ? [form.roleId] : []}
        onSelectionChange={(keys) => {
          const first = Array.from(keys)[0];

          setForm((s) => ({ ...s, roleId: String(first ?? "") }));
        }}
      >
        {roles.map((r) => (
          <SelectItem key={r.id}>{r.name}</SelectItem>
        ))}
      </Select>

      <div className="flex items-center justify-between">
        <span className="text-sm">Activo</span>
        <Switch
          isDisabled={loading}
          isSelected={form.isActive}
          onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
        />
      </div>

      <Button
        className="w-full"
        color="primary"
        isDisabled={loading}
        isLoading={loading}
        onPress={submit}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
