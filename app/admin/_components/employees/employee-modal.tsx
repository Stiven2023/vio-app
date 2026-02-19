"use client";

import type { AdminUserOption, Employee, Role } from "../../_lib/types";
import type { ClientFormPrefill } from "../clients/client-modal.types";
import type { EmployeeFormPrefill } from "./employee-modal.types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Tab, Tabs } from "@heroui/tabs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createEmployeeSchema } from "../../_lib/schemas";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import {
  ContactIcon,
  FormTabTitle,
  IdentificationIcon,
  LocationIcon,
  UserRoleIcon,
} from "@/components/form-tab-title";

type FormState = {
  userId: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string;
  email: string;
  intlDialCode: string;
  mobile: string;
  landline: string;
  extension: string;
  address: string;
  city: string;
  department: string;
  roleId: string;
  isActive: boolean;
  createUserEmail: string;
  createUserPassword: string;
};

const PASSWORD_ALLOWED_REGEX = /^[A-Za-z0-9.*]+$/;

export function EmployeeModal({
  employee,
  prefill,
  users,
  roles,
  isOpen,
  onOpenChange,
  onSaved,
  onRequestCreateClient,
}: {
  employee: Employee | null;
  prefill?: EmployeeFormPrefill | null;
  users: AdminUserOption[];
  roles: Role[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onRequestCreateClient?: (prefill: ClientFormPrefill) => void;
}) {
  type ClientImportData = {
    identificationType: string;
    identification: string;
    dv: string | null;
    name: string;
    email: string;
    intlDialCode: string | null;
    mobile: string | null;
    landline: string | null;
    extension: string | null;
    address: string | null;
    city: string | null;
    department: string | null;
    isActive: boolean | null;
  };

  type IdentificationCheckResponse = {
    sameModule: { message: string } | null;
    otherModule: {
      module: "client" | "employee";
      message: string;
      data: ClientImportData;
    } | null;
  };

  const [form, setForm] = useState<FormState>({
    userId: "",
    name: "",
    identificationType: "CC",
    identification: "",
    dv: "",
    email: "",
    intlDialCode: "57",
    mobile: "",
    landline: "",
    extension: "",
    address: "",
    city: "Medellín",
    department: "ANTIOQUIA",
    roleId: "",
    isActive: true,
    createUserEmail: "",
    createUserPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const canPickUser = useMemo(() => !employee, [employee]);
  const [importPromptOpen, setImportPromptOpen] = useState(false);
  const [importCandidate, setImportCandidate] = useState<ClientImportData | null>(
    null,
  );

  useEffect(() => {
    setErrors({});
    setImportPromptOpen(false);
    setImportCandidate(null);
    const source = employee ?? prefill ?? null;

    setForm({
      userId: source?.userId ?? "",
      name: source?.name ?? "",
      identificationType: source?.identificationType ?? "CC",
      identification: source?.identification ?? "",
      dv: source?.dv ?? "",
      email: source?.email ?? "",
      intlDialCode: source?.intlDialCode ?? "57",
      mobile: source?.mobile ?? "",
      landline: source?.landline ?? "",
      extension: source?.extension ?? "",
      address: source?.address ?? "",
      city: source?.city ?? "Medellín",
      department: source?.department ?? "ANTIOQUIA",
      roleId: source?.roleId ?? "",
      isActive: Boolean(source?.isActive ?? true),
      createUserEmail:
        prefill?.createUserEmail ?? source?.email ?? prefill?.email ?? "",
      createUserPassword: "",
    });
  }, [employee, isOpen, prefill]);

  const checkIdentification = async () => {
    const identification = form.identification.trim();
    if (!identification) return;

    try {
      const params = new URLSearchParams({
        identification,
        identificationType: form.identificationType,
        module: "employee",
      });

      if (employee?.id) params.set("excludeId", employee.id);

      const result = await apiJson<IdentificationCheckResponse>(
        `/api/registry/identification-check?${params.toString()}`,
      );

      if (result.sameModule) {
        const sameModuleMessage = result.sameModule.message;
        setErrors((prev) => ({
          ...prev,
          identification: sameModuleMessage,
        }));
        return;
      }

      setErrors((prev) => {
        if (!prev.identification) return prev;
        const { identification: _identification, ...rest } = prev;

        return rest;
      });

      if (!employee && result.otherModule?.module === "client") {
        setImportCandidate(result.otherModule.data);
        setImportPromptOpen(true);
      }
    } catch {
      // Silencioso: el backend valida nuevamente al guardar.
    }
  };

  const importFromClient = () => {
    if (!importCandidate) return;

    setForm((s) => ({
      ...s,
      name: importCandidate.name ?? s.name,
      identificationType: importCandidate.identificationType ?? s.identificationType,
      identification: importCandidate.identification ?? s.identification,
      dv: importCandidate.dv ?? s.dv,
      email: importCandidate.email ?? s.email,
      intlDialCode: importCandidate.intlDialCode ?? s.intlDialCode,
      mobile: importCandidate.mobile ?? s.mobile,
      landline: importCandidate.landline ?? s.landline,
      extension: importCandidate.extension ?? s.extension,
      address: importCandidate.address ?? s.address,
      city: importCandidate.city ?? s.city,
      department: importCandidate.department ?? s.department,
      isActive: Boolean(importCandidate.isActive ?? s.isActive),
      createUserEmail: importCandidate.email ?? s.createUserEmail,
    }));

    setImportPromptOpen(false);
    setImportCandidate(null);
    toast.success("Datos importados desde clientes");
  };

  const submit = async () => {
    if (submitting) return;
    const parsed = createEmployeeSchema.safeParse(form);

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues)
        next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);

      return;
    }

    const createUserEmail = form.createUserEmail.trim().toLowerCase();
    const createUserPassword = form.createUserPassword.trim();
    const shouldCreateUser =
      !parsed.data.userId &&
      (createUserEmail.length > 0 || createUserPassword.length > 0);

    if (shouldCreateUser) {
      const nextErrors: Record<string, string> = {};

      if (!createUserEmail) {
        nextErrors.createUserEmail = "Email requerido para crear usuario";
      }

      if (!createUserPassword) {
        nextErrors.createUserPassword = "Contraseña requerida";
      } else {
        if (createUserPassword.length < 7) {
          nextErrors.createUserPassword = "Mínimo 7 caracteres";
        } else if (!/[A-Z]/.test(createUserPassword)) {
          nextErrors.createUserPassword = "Debe incluir al menos 1 mayúscula";
        } else if (!PASSWORD_ALLOWED_REGEX.test(createUserPassword)) {
          nextErrors.createUserPassword = "Solo letras, números, . y *";
        }
      }

      if (
        createUserEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserEmail)
      ) {
        nextErrors.createUserEmail = "Email inválido";
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...nextErrors }));
        return;
      }
    }

    setErrors({});
    try {
      setSubmitting(true);
      const payload = employee
        ? { id: employee.id, ...parsed.data }
        : {
            ...parsed.data,
            createUser: shouldCreateUser
              ? {
                  email: createUserEmail,
                  password: createUserPassword,
                }
              : undefined,
          };

      await apiJson(`/api/employees`, {
        method: employee ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(employee ? "Empleado actualizado" : "Empleado creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="3xl" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span>{employee ? "Editar empleado" : "Crear empleado"}</span>
          {employee?.employeeCode && (
            <span className="font-mono text-xs font-normal text-primary">
              {employee.employeeCode}
            </span>
          )}
        </ModalHeader>
        <ModalBody>
          <Tabs aria-label="Formulario de empleado" variant="underlined">
            <Tab
              key="identificacion"
              title={<FormTabTitle icon={<IdentificationIcon />} label="Identificación" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
                <Input
                  errorMessage={errors.name}
                  isInvalid={Boolean(errors.name)}
                  label="Nombre"
                  value={form.name}
                  onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
                />

                <Select
                  errorMessage={errors.identificationType}
                  isInvalid={Boolean(errors.identificationType)}
                  label="Tipo de identificación"
                  selectedKeys={[form.identificationType]}
                  onSelectionChange={(keys) => {
                    const first = Array.from(keys)[0];
                    setForm((s) => ({ ...s, identificationType: String(first ?? "CC") }));
                  }}
                >
                  <SelectItem key="CC">Cédula de ciudadanía (CC)</SelectItem>
                  <SelectItem key="NIT">NIT</SelectItem>
                  <SelectItem key="CE">Cédula de extranjería (CE)</SelectItem>
                  <SelectItem key="PAS">Pasaporte (PAS)</SelectItem>
                  <SelectItem key="EMPRESA_EXTERIOR">Empresa exterior</SelectItem>
                </Select>

                <Input
                  errorMessage={errors.identification}
                  isInvalid={Boolean(errors.identification)}
                  label="Identificación"
                  value={form.identification}
                  onBlur={checkIdentification}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, identification: v }))
                  }
                />

                <Input
                  errorMessage={errors.dv}
                  isInvalid={Boolean(errors.dv)}
                  label="Dígito verificación"
                  maxLength={1}
                  value={form.dv}
                  onValueChange={(v) => setForm((s) => ({ ...s, dv: v }))}
                />
              </div>
            </Tab>

            <Tab
              key="contacto"
              title={<FormTabTitle icon={<ContactIcon />} label="Contacto" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
                <Input
                  errorMessage={errors.email}
                  isInvalid={Boolean(errors.email)}
                  label="Correo"
                  type="email"
                  value={form.email}
                  onValueChange={(v) =>
                    setForm((s) => ({
                      ...s,
                      email: v,
                      createUserEmail: s.createUserEmail || v,
                    }))
                  }
                />

                <Input
                  errorMessage={errors.intlDialCode}
                  isInvalid={Boolean(errors.intlDialCode)}
                  label="Código internacional"
                  value={form.intlDialCode}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, intlDialCode: v }))
                  }
                />

                <Input
                  errorMessage={errors.mobile}
                  isInvalid={Boolean(errors.mobile)}
                  label="Móvil"
                  value={form.mobile}
                  onValueChange={(v) => setForm((s) => ({ ...s, mobile: v }))}
                />

                <Input
                  label="Fijo"
                  value={form.landline}
                  onValueChange={(v) => setForm((s) => ({ ...s, landline: v }))}
                />

                <Input
                  errorMessage={errors.extension}
                  isInvalid={Boolean(errors.extension)}
                  label="Extensión"
                  value={form.extension}
                  onValueChange={(v) => setForm((s) => ({ ...s, extension: v }))}
                />
              </div>
            </Tab>

            <Tab
              key="ubicacion"
              title={<FormTabTitle icon={<LocationIcon />} label="Ubicación" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
                <Input
                  label="Dirección"
                  value={form.address}
                  onValueChange={(v) => setForm((s) => ({ ...s, address: v }))}
                />

                <Input
                  label="Ciudad"
                  value={form.city}
                  onValueChange={(v) => setForm((s) => ({ ...s, city: v }))}
                />

                <Input
                  label="Departamento"
                  value={form.department}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, department: v }))
                  }
                />
              </div>
            </Tab>

            <Tab
              key="usuario-rol"
              title={<FormTabTitle icon={<UserRoleIcon />} label="Usuario y rol" />}
            >
              <div className="space-y-4 pt-3">
                <div className="flex items-end gap-2">
                  <Select
                    errorMessage={errors.userId}
                    isDisabled={!canPickUser}
                    isInvalid={Boolean(errors.userId)}
                    label="Usuario"
                    selectedKeys={form.userId ? [form.userId] : []}
                    onSelectionChange={(keys) => {
                      const first = Array.from(keys)[0];

                      setForm((s) => ({ ...s, userId: String(first ?? "") }));
                    }}
                  >
                    {users.map((u) => (
                      <SelectItem key={u.id}>{u.email}</SelectItem>
                    ))}
                  </Select>

                  <Dropdown>
                    <DropdownTrigger>
                      <Button isDisabled={!canPickUser || Boolean(form.userId)} variant="flat">
                        Crear usuario
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Creador de usuario" closeOnSelect={false}>
                      <DropdownItem key="creator" textValue="Creador de usuario">
                        <div className="w-[280px] space-y-2 py-1">
                          <Input
                            errorMessage={errors.createUserEmail}
                            isInvalid={Boolean(errors.createUserEmail)}
                            label="Email usuario"
                            placeholder="usuario@dominio.com"
                            type="email"
                            value={form.createUserEmail}
                            onValueChange={(v) =>
                              setForm((s) => ({ ...s, createUserEmail: v }))
                            }
                          />
                          <Input
                            errorMessage={errors.createUserPassword}
                            isInvalid={Boolean(errors.createUserPassword)}
                            label="Contraseña"
                            placeholder="Mínimo 7, 1 mayúscula"
                            type="password"
                            value={form.createUserPassword}
                            onValueChange={(v) =>
                              setForm((s) => ({ ...s, createUserPassword: v }))
                            }
                          />
                          <p className="text-xs text-default-500">
                            Opcional. Si completas estos campos, se crea y asocia el
                            usuario sin exigir verificación de email.
                          </p>
                        </div>
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>

                <Select
                  errorMessage={errors.roleId}
                  isInvalid={Boolean(errors.roleId)}
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
                  <span className="text-sm text-default-500">Activo</span>
                  <Switch
                    isSelected={form.isActive}
                    onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                  />
                </div>
              </div>
            </Tab>
          </Tabs>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="flat"
            onPress={() => {
              onRequestCreateClient?.({
                clientType: "EMPLEADO",
                priceClientType: "VIOMAR",
                name: form.name,
                identificationType: form.identificationType,
                identification: form.identification,
                dv: form.dv,
                taxRegime: "REGIMEN_COMUN",
                contactName: form.name,
                email: form.email,
                address: form.address,
                city: form.city,
                department: form.department,
                intlDialCode: form.intlDialCode,
                mobile: form.mobile,
                landline: form.landline,
                extension: form.extension,
                isActive: form.isActive,
                status: form.isActive ? "ACTIVO" : "INACTIVO",
              });
              onOpenChange(false);
            }}
          >
            Crear como cliente
          </Button>

          <Button
            isDisabled={submitting}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button color="primary" isLoading={submitting} onPress={submit}>
            {employee ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>

      <ConfirmActionModal
        cancelLabel="No importar"
        confirmColor="primary"
        confirmLabel="Importar datos"
        description="Esta identificación ya existe en clientes. ¿Deseas importar esos datos para crear el empleado?"
        isOpen={importPromptOpen}
        title="Identificación encontrada en clientes"
        onConfirm={importFromClient}
        onOpenChange={(open) => {
          if (!open) setImportCandidate(null);
          setImportPromptOpen(open);
        }}
      />
    </Modal>
  );
}
