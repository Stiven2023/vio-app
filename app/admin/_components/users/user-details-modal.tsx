"use client";

import type { AdminUser, Employee } from "../../_lib/types";

import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

type UserDetail = {
  user: AdminUser;
  employee: Employee | null;
  role: { id: string; name: string } | null;
};

export function UserDetailsModal({
  detail,
  isOpen,
  onOpenChange,
}: {
  detail: UserDetail | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!detail) return null;

  const { user, employee, role } = detail;

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-lg font-semibold">{user.email}</span>
          <span className="text-sm font-normal text-default-500">
            Detalles completos del usuario
          </span>
        </ModalHeader>
        <ModalBody>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Datos del usuario
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField label="ID" value={user.id} />
              <DetailField label="Email" value={user.email} />
              <DetailField
                label="Email verificado"
                value={user.emailVerified ? "Sí" : "No"}
              />
              <DetailField label="Activo" value={user.isActive ? "Sí" : "No"} />
              <DetailField
                label="Creado"
                value={
                  user.createdAt
                    ? new Date(user.createdAt).toLocaleString("es-CO")
                    : null
                }
              />
            </div>
          </div>

          <Divider />

          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Empleado asociado
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField label="Empleado ID" value={employee?.id} />
              <DetailField label="Nombre" value={employee?.name} />
              <DetailField
                label="Tipo identificación"
                value={employee?.identificationType}
              />
              <DetailField
                label="Identificación"
                value={employee?.identification}
              />
              <DetailField label="Correo" value={employee?.email} />
              <DetailField label="Móvil" value={employee?.fullMobile ?? employee?.mobile} />
              <DetailField label="Rol ID" value={employee?.roleId} />
              <DetailField label="Rol" value={role?.name} />
              <DetailField
                label="Activo"
                value={
                  employee
                    ? employee.isActive
                      ? "Sí"
                      : "No"
                    : null
                }
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-default-500">{label}</dt>
      <dd className="text-sm text-default-700">
        {value && value.trim() !== "" ? (
          value
        ) : (
          <span className="text-default-400">Sin información</span>
        )}
      </dd>
    </div>
  );
}
