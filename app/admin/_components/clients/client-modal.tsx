"use client";

import type { Client } from "../../_lib/types";
import type { FormState } from "./client-modal.types";

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
import { IdentificationTab } from "./client-modal-tabs/identification-tab";
import { ContactTab } from "./client-modal-tabs/contact-tab";
import { LocationTab } from "./client-modal-tabs/location-tab";
import { PhonesTab } from "./client-modal-tabs/phones-tab";
import { StatusCreditTab } from "./client-modal-tabs/status-credit-tab";

export function ClientModal({
  client,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  client: Client | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    clientType: "NACIONAL",
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

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setForm({
      clientType: client?.clientType ?? "NACIONAL",
      name: client?.name ?? "",
      identificationType: client?.identificationType ?? "CC",
      identification: client?.identification ?? "",
      dv: client?.dv ?? "",
      branch: client?.branch ?? "01",
      taxRegime: client?.taxRegime ?? "REGIMEN_COMUN",
      contactName: client?.contactName ?? "",
      email: client?.email ?? "",
      address: client?.address ?? "",
      postalCode: client?.postalCode ?? "",
      country: client?.country ?? "COLOMBIA",
      department: client?.department ?? "ANTIOQUIA",
      city: client?.city ?? "Medellín",
      intlDialCode: client?.intlDialCode ?? "57",
      mobile: client?.mobile ?? "",
      localDialCode: client?.localDialCode ?? "",
      landline: client?.landline ?? "",
      extension: client?.extension ?? "",
      hasCredit: Boolean(client?.hasCredit ?? false),
      promissoryNoteNumber: client?.promissoryNoteNumber ?? "",
      promissoryNoteDate: client?.promissoryNoteDate ?? "",
      status: client?.status ?? "ACTIVO",
      isActive: Boolean(client?.isActive ?? true),
    });
  }, [client, isOpen]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);

    const parsed = createClientSchema.safeParse({
      clientType: form.clientType,
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
    </Modal>
  );
}
