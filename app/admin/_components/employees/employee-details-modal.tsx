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

type EmployeeDetail = {
  employee: Employee;
  user: AdminUser | null;
};

export function EmployeeDetailsModal({
  detail,
  isOpen,
  onOpenChange,
}: {
  detail: EmployeeDetail | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!detail) return null;

  const { employee, user } = detail;

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-lg font-semibold">{employee.name}</span>
          <span className="text-sm font-normal text-default-500">
            Detalles completos del empleado
          </span>
        </ModalHeader>
        <ModalBody>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Datos del empleado
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField label="Código" value={employee.employeeCode} />
              <DetailField label="ID" value={employee.id} />
              <DetailField label="Nombre" value={employee.name} />
              <DetailField
                label="Tipo identificación"
                value={employee.identificationType}
              />
              <DetailField
                label="Identificación"
                value={employee.identification}
              />
              <DetailField label="DV" value={employee.dv} />
              <DetailField label="Correo" value={employee.email} />
              <DetailField
                label="Código internacional"
                value={employee.intlDialCode}
              />
              <DetailField label="Móvil" value={employee.mobile} />
              <DetailField label="Móvil completo" value={employee.fullMobile} />
              <DetailField label="Fijo" value={employee.landline} />
              <DetailField label="Extensión" value={employee.extension} />
              <DetailField label="Dirección" value={employee.address} />
              <DetailField label="Ciudad" value={employee.city} />
              <DetailField label="Departamento" value={employee.department} />
              <DetailField label="Role ID" value={employee.roleId} />
              <DetailField label="Activo" value={employee.isActive ? "Sí" : "No"} />
            </div>
          </div>

          <Divider />

          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Usuario asociado
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField label="Usuario ID" value={employee.userId} />
              <DetailField label="Email" value={user?.email} />
              <DetailField
                label="Email verificado"
                value={user ? (user.emailVerified ? "Sí" : "No") : null}
              />
              <DetailField
                label="Activo"
                value={user ? (user.isActive ? "Sí" : "No") : null}
              />
              <DetailField
                label="Creado"
                value={
                  user?.createdAt
                    ? new Date(user.createdAt).toLocaleString("es-CO")
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
