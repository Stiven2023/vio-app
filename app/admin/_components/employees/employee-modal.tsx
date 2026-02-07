






























































































"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createEmployeeSchema } from "../../_lib/schemas";
import type { AdminUserOption, Employee, Role } from "../../_lib/types";

type FormState = { userId: string; name: string; roleId: string; isActive: boolean };

export function EmployeeModal({ employee, users, roles, isOpen, onOpenChange, onSaved }: { employee: Employee | null; users: AdminUserOption[]; roles: Role[]; isOpen: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>({ userId: "", name: "", roleId: "", isActive: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canPickUser = useMemo(() => !employee, [employee]);

  useEffect(() => {
    setErrors({});
    setForm({
      userId: employee?.userId ?? "",
      name: employee?.name ?? "",
      roleId: employee?.roleId ?? "",
      isActive: Boolean(employee?.isActive ?? true),
    });
  }, [employee, isOpen]);

  const submit = async () => {
    const parsed = createEmployeeSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await apiJson(`/api/employees`, {
        method: employee ? "PUT" : "POST",
        body: JSON.stringify(employee ? { id: employee.id, ...parsed.data } : parsed.data),
      });
      toast.success(employee ? "Empleado actualizado" : "Empleado creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{employee ? "Editar empleado" : "Crear empleado"}</ModalHeader>
        <ModalBody>
          <Select
            label="Usuario"
            isDisabled={!canPickUser}
            selectedKeys={form.userId ? [form.userId] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setForm((s) => ({ ...s, userId: String(first ?? "") }));
            }}
            isInvalid={Boolean(errors.userId)}
            errorMessage={errors.userId}
          >
            {users.map((u) => (
              <SelectItem key={u.id}>{u.email}</SelectItem>
            ))}
          </Select>

          <Input label="Nombre" value={form.name} onValueChange={(v) => setForm((s) => ({ ...s, name: v }))} isInvalid={Boolean(errors.name)} errorMessage={errors.name} />

          <Select
            label="Rol"
            selectedKeys={form.roleId ? [form.roleId] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setForm((s) => ({ ...s, roleId: String(first ?? "") }));
            }}
            isInvalid={Boolean(errors.roleId)}
            errorMessage={errors.roleId}
          >
            {roles.map((r) => (
              <SelectItem key={r.id}>{r.name}</SelectItem>
            ))}
          </Select>

          <div className="flex items-center justify-between">
            <span className="text-sm">Activo</span>
            <Switch isSelected={form.isActive} onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" onPress={submit}>
            {employee ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
