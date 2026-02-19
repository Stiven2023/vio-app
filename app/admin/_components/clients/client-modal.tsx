"use client";

import type { Client } from "../../_lib/types";
import type { ClientFormPrefill, FormState } from "./client-modal.types";
import type { EmployeeFormPrefill } from "../employees/employee-modal.types";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Tabs, Tab } from "@heroui/tabs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createClientSchema } from "../../_lib/schemas";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { IdentificationTab } from "./client-modal-tabs/identification-tab";
import { ContactTab } from "./client-modal-tabs/contact-tab";
import { LocationTab } from "./client-modal-tabs/location-tab";
import { PhonesTab } from "./client-modal-tabs/phones-tab";
import { StatusCreditTab } from "./client-modal-tabs/status-credit-tab";

export function ClientModal({
  client,
  isOpen,
  prefill,
  onRequestCreateEmployee,
  onOpenChange,
  onSaved,
}: {
  client: Client | null;
  isOpen: boolean;
  prefill?: ClientFormPrefill | null;
  onRequestCreateEmployee?: (prefill: EmployeeFormPrefill) => void;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  type EmployeeImportData = {
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
      module: "employee" | "client";
      message: string;
      data: EmployeeImportData;
    } | null;
  };

  const [form, setForm] = useState<FormState>({
    clientType: "NACIONAL",
    priceClientType: "VIOMAR",
    name: "",
    identificationType: "CC",
    identification: "",
    dv: "",
    branch: "01",
    taxRegime: "REGIMEN_COMUN",
    contactName: "",
    email: "",
    address: "",
    postalCode: "",
    country: "COLOMBIA",
    department: "ANTIOQUIA",
    city: "Medellín",
    intlDialCode: "57",
    mobile: "",
    localDialCode: "",
    landline: "",
    extension: "",
    hasCredit: false,
    promissoryNoteNumber: "",
    promissoryNoteDate: "",
    status: "ACTIVO",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [importPromptOpen, setImportPromptOpen] = useState(false);
  const [importCandidate, setImportCandidate] =
    useState<EmployeeImportData | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setImportPromptOpen(false);
    setImportCandidate(null);
    const baseForm: FormState = {
      clientType: "NACIONAL",
      priceClientType: "VIOMAR",
      name: "",
      identificationType: "CC",
      identification: "",
      dv: "",
      branch: "01",
      taxRegime: "REGIMEN_COMUN",
      contactName: "",
      email: "",
      address: "",
      postalCode: "",
      country: "COLOMBIA",
      department: "ANTIOQUIA",
      city: "Medellín",
      intlDialCode: "57",
      mobile: "",
      localDialCode: "",
      landline: "",
      extension: "",
      hasCredit: false,
      promissoryNoteNumber: "",
      promissoryNoteDate: "",
      status: "ACTIVO",
      isActive: true,
    };

    if (client) {
      setForm({
        ...baseForm,
        clientType: client.clientType ?? "NACIONAL",
        priceClientType: client.priceClientType ?? "VIOMAR",
        name: client.name ?? "",
        identificationType: client.identificationType ?? "CC",
        identification: client.identification ?? "",
        dv: client.dv ?? "",
        branch: client.branch ?? "01",
        taxRegime: client.taxRegime ?? "REGIMEN_COMUN",
        contactName: client.contactName ?? "",
        email: client.email ?? "",
        address: client.address ?? "",
        postalCode: client.postalCode ?? "",
        country: client.country ?? "COLOMBIA",
        department: client.department ?? "ANTIOQUIA",
        city: client.city ?? "Medellín",
        intlDialCode: client.intlDialCode ?? "57",
        mobile: client.mobile ?? "",
        localDialCode: client.localDialCode ?? "",
        landline: client.landline ?? "",
        extension: client.extension ?? "",
        hasCredit: Boolean(client.hasCredit ?? false),
        promissoryNoteNumber: client.promissoryNoteNumber ?? "",
        promissoryNoteDate: client.promissoryNoteDate ?? "",
        status: client.status ?? "ACTIVO",
        isActive: Boolean(client.isActive ?? true),
      });
      return;
    }

    setForm({
      ...baseForm,
      ...prefill,
    });
  }, [client, isOpen, prefill]);

  const checkIdentification = async () => {
    const identification = form.identification.trim();
    if (!identification) return;

    try {
      const params = new URLSearchParams({
        identification,
        identificationType: form.identificationType,
        module: "client",
      });

      if (client?.id) params.set("excludeId", client.id);

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

      if (!client && result.otherModule?.module === "employee") {
        setImportCandidate(result.otherModule.data);
        setImportPromptOpen(true);
      }
    } catch {
      // Silencioso: el backend valida nuevamente al guardar.
    }
  };

  const importFromEmployee = () => {
    if (!importCandidate) return;

    setForm((s) => ({
      ...s,
      name: importCandidate.name ?? s.name,
      identificationType: importCandidate.identificationType ?? s.identificationType,
      identification: importCandidate.identification ?? s.identification,
      dv: importCandidate.dv ?? s.dv,
      contactName: importCandidate.name ?? s.contactName,
      email: importCandidate.email ?? s.email,
      address: importCandidate.address ?? s.address,
      city: importCandidate.city ?? s.city,
      department: importCandidate.department ?? s.department,
      intlDialCode: importCandidate.intlDialCode ?? s.intlDialCode,
      mobile: importCandidate.mobile ?? s.mobile,
      landline: importCandidate.landline ?? s.landline,
      extension: importCandidate.extension ?? s.extension,
      isActive: Boolean(importCandidate.isActive ?? s.isActive),
      status: importCandidate.isActive === false ? "INACTIVO" : s.status,
    }));

    setImportPromptOpen(false);
    setImportCandidate(null);
    toast.success("Datos importados desde empleados");
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);

    const parsed = createClientSchema.safeParse({
      clientType: form.clientType,
      priceClientType: form.priceClientType,
      name: form.name,
      identificationType: form.identificationType,
      identification: form.identification,
      dv: form.dv || undefined,
      branch: form.branch || undefined,
      taxRegime: form.taxRegime,
      contactName: form.contactName,
      email: form.email,
      address: form.address,
      postalCode: form.postalCode || undefined,
      country: form.country || undefined,
      department: form.department || undefined,
      city: form.city || undefined,
      intlDialCode: form.intlDialCode || undefined,
      mobile: form.mobile,
      localDialCode: form.localDialCode || undefined,
      landline: form.landline || undefined,
      extension: form.extension || undefined,
      hasCredit: form.hasCredit,
      promissoryNoteNumber: form.promissoryNoteNumber || undefined,
      promissoryNoteDate: form.promissoryNoteDate || undefined,
      status: form.status as "ACTIVO" | "INACTIVO" | "SUSPENDIDO",
      isActive: form.isActive,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        next[String(issue.path[0] ?? "form")] = issue.message;
      }
      setErrors(next);

      return;
    }

    setErrors({});

    try {
      setSubmitting(true);
      await apiJson(`/api/clients`, {
        method: client ? "PUT" : "POST",
        body: JSON.stringify(
          client ? { id: client.id, ...parsed.data } : parsed.data,
        ),
      });

      toast.success(client ? "Cliente actualizado" : "Cliente creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        <ModalHeader>
          {client ? "Editar cliente" : "Crear cliente"}
          <p className="mt-1 text-xs font-normal text-default-500">
            Los campos marcados con <span className="text-danger">*</span> son
            críticos
          </p>
        </ModalHeader>
        <ModalBody>
          <Tabs aria-label="Secciones del formulario" variant="underlined">
            {/* TAB 1: IDENTIFICACIÓN */}
            <Tab key="identification" title="Identificación">
              <IdentificationTab
                errors={errors}
                form={form}
                isEditing={Boolean(client)}
                onIdentificationBlur={checkIdentification}
                setForm={setForm}
              />
            </Tab>

            {/* TAB 2: CONTACTO Y FISCAL */}
            <Tab key="contact" title="Contacto y fiscal">
              <ContactTab errors={errors} form={form} setForm={setForm} />
            </Tab>

            {/* TAB 3: UBICACIÓN */}
            <Tab key="location" title="Ubicación">
              <LocationTab errors={errors} form={form} setForm={setForm} />
            </Tab>

            {/* TAB 4: TELÉFONOS */}
            <Tab key="phones" title="Teléfonos">
              <PhonesTab errors={errors} form={form} setForm={setForm} />
            </Tab>

            {/* TAB 5: ESTADO Y CRÉDITO */}
            <Tab key="status-credit" title="Estado y crédito">
              <StatusCreditTab form={form} setForm={setForm} />
            </Tab>
          </Tabs>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={submitting}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button color="primary" isLoading={submitting} onPress={submit}>
            {client ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </ModalFooter>
      </ModalContent>

      <ConfirmActionModal
        cancelLabel="No importar"
        confirmColor="primary"
        confirmLabel="Importar datos"
        description="Esta identificación ya existe en empleados. ¿Deseas importar esos datos para crear el cliente?"
        isOpen={importPromptOpen}
        title="Identificación encontrada en empleados"
        onConfirm={importFromEmployee}
        onOpenChange={(open) => {
          if (!open) setImportCandidate(null);
          setImportPromptOpen(open);
        }}
      />
    </Modal>
  );
}
