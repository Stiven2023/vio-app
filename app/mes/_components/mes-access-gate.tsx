"use client";

import type {
  MesAccessEmployee,
  MesAccessSelection,
} from "@/app/mes/_components/mes-types";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem } from "@heroui/react";

import {
  getMesAccessProcessOption,
  MES_ACCESS_PROCESS_OPTIONS,
} from "@/app/mes/_components/mes-config";

type ApiResponse = {
  items?: MesAccessEmployee[];
};

type MesSessionResponse = {
  selection?: MesAccessSelection;
  message?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MesAccessGate({
  initialSelection,
  onSubmit,
}: {
  initialSelection?: MesAccessSelection | null;
  onSubmit: (selection: MesAccessSelection) => void | Promise<void>;
}) {
  const [email, setEmail] = useState(initialSelection?.email ?? "");
  const [processKey, setProcessKey] = useState<string>(
    initialSelection?.processKey ?? "",
  );
  const [machineId, setMachineId] = useState<string>(
    initialSelection?.machineId ?? "",
  );
  const [employeeId, setEmployeeId] = useState<string>(
    initialSelection?.employeeId ?? "",
  );
  const [employees, setEmployees] = useState<MesAccessEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [submitError, setSubmitError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const selectedProcess = useMemo(
    () => getMesAccessProcessOption(processKey),
    [processKey],
  );
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId) ?? null,
    [employeeId, employees],
  );

  useEffect(() => {
    let active = true;

    setLoadingEmployees(true);
    fetch("/api/mes/access-options", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;

          throw new Error(
            String(payload?.message ?? "No se pudieron cargar los operarios de MES."),
          );
        }

        return response.json() as Promise<ApiResponse>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        setEmployees(Array.isArray(payload.items) ? payload.items : []);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setEmployees([]);
        setSubmitError(
          error instanceof Error && error.message
            ? error.message
            : "No se pudieron cargar los operarios de MES.",
        );
      })
      .finally(() => {
        if (active) {
          setLoadingEmployees(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedProcess) {
      setMachineId("");
      return;
    }

    if (!selectedProcess.requiresMachine) {
      setMachineId("");
      return;
    }

    const machineExists = selectedProcess.machines.some(
      (machine) => machine.id === machineId,
    );

    if (!machineExists) {
      setMachineId(selectedProcess.machines[0]?.id ?? "");
    }
  }, [machineId, selectedProcess]);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      setSubmitError("Debes ingresar un correo válido para el acceso MES.");
      return;
    }

    if (!selectedProcess) {
      setSubmitError("Debes seleccionar un proceso para ingresar a MES.");
      return;
    }

    if (selectedProcess.requiresMachine && !machineId) {
      setSubmitError("Debes seleccionar una máquina para el proceso elegido.");
      return;
    }

    if (!selectedEmployee) {
      setSubmitError("Debes seleccionar un empleado operario para continuar.");
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/mes/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: normalizedEmail,
          processKey: selectedProcess.key,
          machineId: selectedProcess.requiresMachine ? machineId : null,
          employeeId: selectedEmployee.id,
        }),
      });
      const payload = (await response.json().catch(() => null)) as MesSessionResponse | null;

      if (!response.ok || !payload?.selection) {
        throw new Error(
          String(payload?.message ?? "No se pudo iniciar la sesión MES."),
        );
      }

      await onSubmit(payload.selection);
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo iniciar la sesión MES.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-default-200" radius="sm" shadow="none">
      <CardHeader className="flex flex-col items-start gap-1">
        <h2 className="text-lg font-semibold">Acceso operativo MES</h2>
        <p className="text-sm text-default-500">
          Ingresa el correo, el proceso, la máquina si aplica y el empleado operario.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            aria-label="Correo de acceso MES"
            isRequired
            label="Correo"
            placeholder="operacion@viomar.com"
            type="email"
            value={email}
            onValueChange={(value) => {
              setEmail(value);
              if (submitError) {
                setSubmitError("");
              }
            }}
          />
          <Select
            aria-label="Proceso operativo MES"
            disallowEmptySelection
            isRequired
            label="Proceso"
            selectedKeys={processKey ? [processKey] : []}
            onSelectionChange={(keys) => {
              const nextValue = String(Array.from(keys)[0] ?? "");

              setProcessKey(nextValue);
              if (submitError) {
                setSubmitError("");
              }
            }}
          >
            {MES_ACCESS_PROCESS_OPTIONS.map((processOption) => (
              <SelectItem key={processOption.key}>{processOption.label}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Máquina MES"
            disallowEmptySelection
            isDisabled={!selectedProcess?.requiresMachine}
            isRequired={Boolean(selectedProcess?.requiresMachine)}
            label="Máquina"
            placeholder={
              selectedProcess?.requiresMachine
                ? "Selecciona una máquina"
                : "Este proceso no requiere máquina"
            }
            selectedKeys={machineId ? [machineId] : []}
            onSelectionChange={(keys) => {
              setMachineId(String(Array.from(keys)[0] ?? ""));
              if (submitError) {
                setSubmitError("");
              }
            }}
          >
            {(selectedProcess?.machines ?? []).map((machine) => (
              <SelectItem key={machine.id}>{machine.name}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Empleado operario MES"
            disallowEmptySelection
            isDisabled={loadingEmployees || employees.length === 0}
            isLoading={loadingEmployees}
            isRequired
            label="Empleado"
            placeholder={
              loadingEmployees
                ? "Cargando operarios..."
                : "Selecciona un operario"
            }
            selectedKeys={employeeId ? [employeeId] : []}
            onSelectionChange={(keys) => {
              setEmployeeId(String(Array.from(keys)[0] ?? ""));
              if (submitError) {
                setSubmitError("");
              }
            }}
          >
            {employees.map((employee) => (
              <SelectItem key={employee.id} textValue={`${employee.name} ${employee.role ?? ""}`}>
                {employee.name}
                {employee.role ? ` · ${employee.role}` : ""}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="rounded-medium border border-default-200 bg-default-50 px-3 py-2 text-xs text-default-600">
          El selector de empleado incluye todos los empleados con rol OPERARIO y roles OPERARIO_* activos.
        </div>

        {submitError ? (
          <div className="rounded-medium border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger" role="alert">
            {submitError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button color="primary" isLoading={submitting} onPress={() => void handleSubmit()}>
            Ingresar a MES
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}