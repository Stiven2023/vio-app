"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createRolePermissionSchema } from "../../_lib/schemas";
import type { Permission, Role } from "../../_lib/types";

export function RolePermissionsModal({ roles, permissions, isOpen, onOpenChange, onCreated }: { roles: Role[]; permissions: Permission[]; isOpen: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState({ roleId: "", permissionId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) {
      setForm({ roleId: "", permissionId: "" });
      setErrors({});
    }
  }, [isOpen]);

  const submit = async () => {
    const parsed = createRolePermissionSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await apiJson(`/api/role-permissions`, { method: "POST", body: JSON.stringify(parsed.data) });
      toast.success("Relación creada");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Crear relación</ModalHeader>
        <ModalBody>
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
          <Select
            label="Permiso"
            selectedKeys={form.permissionId ? [form.permissionId] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setForm((s) => ({ ...s, permissionId: String(first ?? "") }));
            }}
            isInvalid={Boolean(errors.permissionId)}
            errorMessage={errors.permissionId}
          >
            {permissions.map((p) => (
              <SelectItem key={p.id}>{p.name}</SelectItem>
            ))}
          </Select>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" onPress={submit}>
            Crear
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
