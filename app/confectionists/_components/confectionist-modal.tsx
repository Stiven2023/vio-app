"use client";

import type { Confectionist } from "./confectionists-tab";
import type { ConfectionistFormPrefill } from "./confectionist-modal.types";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
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
import { z } from "zod";

import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";

const confectionistSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  identificationType: z.string().trim().min(1, "Tipo de identificación requerido"),
  identification: z.string().trim().min(1, "Identificación requerida"),
  dv: z.string().trim().optional(),
  taxRegime: z.string().trim().min(1, "Régimen fiscal requerido"),
  address: z.string().trim().min(1, "Dirección requerida"),
  type: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  email: z.string().trim().optional(),
  intlDialCode: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  landline: z.string().trim().optional(),
  extension: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  department: z.string().trim().optional(),
  city: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

type FormState = {
  name: string;
  identificationType: string;
  identification: string;
  dv: string;
  taxRegime: string;
  type: string;
  contactName: string;
  email: string;
  intlDialCode: string;
  mobile: string;
  landline: string;
  extension: string;
  address: string;
  postalCode: string;
  country: string;
  department: string;
  city: string;
  isActive: boolean;
};

export function ConfectionistModal({
  confectionist,
  prefill,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  confectionist: Confectionist | null;
  prefill?: ConfectionistFormPrefill | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  type ImportData = {
    module: "client" | "employee" | "confectionist" | "supplier" | "packer";
    name: string;
    identificationType: string;
    identification: string;
    dv: string | null;
    email: string | null;
    contactName: string | null;
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
      module: "client" | "employee" | "confectionist" | "supplier" | "packer";
      message: string;
      data: ImportData;
    } | null;
  };

  const [form, setForm] = useState<FormState>({
    name: "",
    identificationType: "",
    identification: "",
    dv: "",
    taxRegime: "",
    type: "",
    contactName: "",
    email: "",
    intlDialCode: "57",
    mobile: "",
    landline: "",
    extension: "",
    address: "",
    postalCode: "",
    country: "COLOMBIA",
    department: "ANTIOQUIA",
    city: "Medellín",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [importPromptOpen, setImportPromptOpen] = useState(false);
  const [importCandidate, setImportCandidate] = useState<ImportData | null>(null);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setImportPromptOpen(false);
    setImportCandidate(null);
    setImportMessage("");

    // Si hay prefill, usarlo; sino, usar confectionist existente o valores por defecto
    if (prefill) {
      setForm({
        name: prefill.name,
        identificationType: prefill.identificationType,
        identification: prefill.identification,
        dv: prefill.dv,
        taxRegime: prefill.taxRegime,
        type: "", // type no viene en prefill
        contactName: prefill.contactName,
        email: prefill.email,
        intlDialCode: prefill.intlDialCode,
        mobile: prefill.mobile,
        landline: prefill.landline,
        extension: prefill.extension,
        address: prefill.address,
        postalCode: prefill.postalCode,
        country: prefill.country,
        department: prefill.department,
        city: prefill.city,
        isActive: prefill.isActive,
      });
    } else {
      setForm({
        name: confectionist?.name ?? "",
        identificationType: confectionist?.identificationType ?? "",
        identification: confectionist?.identification ?? "",
        dv: confectionist?.dv ?? "",
        taxRegime: confectionist?.taxRegime ?? "",
        type: confectionist?.type ?? "",
        contactName: confectionist?.contactName ?? "",
        email: confectionist?.email ?? "",
        intlDialCode: confectionist?.intlDialCode ?? "57",
        mobile: confectionist?.mobile ?? "",
        landline: confectionist?.landline ?? "",
        extension: confectionist?.extension ?? "",
        address: confectionist?.address ?? "",
        postalCode: confectionist?.postalCode ?? "",
        country: confectionist?.country ?? "COLOMBIA",
        department: confectionist?.department ?? "ANTIOQUIA",
        city: confectionist?.city ?? "Medellín",
        isActive: Boolean(confectionist?.isActive ?? true),
      });
    }
  }, [confectionist, prefill, isOpen]);

  const checkIdentification = async () => {
    const identification = form.identification.trim();
    if (!identification) return;

    try {
      const params = new URLSearchParams({
        identification,
        identificationType: form.identificationType,
        module: "confectionist",
      });

      if (confectionist?.id) params.set("excludeId", confectionist.id);

      const result = await apiJson<IdentificationCheckResponse>(
        `/api/registry/identification-check?${params.toString()}`,
      );

      if (result.sameModule) {
        setErrors((prev) => ({
          ...prev,
          identification: result.sameModule?.message ?? "Identificación duplicada",
        }));
        return;
      }

      setErrors((prev) => {
        if (!prev.identification) return prev;
        const { identification: _identification, ...rest } = prev;
        return rest;
      });

      if (!confectionist && result.otherModule) {
        setImportCandidate(result.otherModule.data);
        setImportMessage(result.otherModule.message);
        setImportPromptOpen(true);
      }
    } catch {
      // El backend valida nuevamente al guardar.
    }
  };

  const importFromOtherModule = () => {
    if (!importCandidate) return;

    setForm((s) => ({
      ...s,
      name: importCandidate.name ?? s.name,
      identificationType: importCandidate.identificationType ?? s.identificationType,
      identification: importCandidate.identification ?? s.identification,
      dv: importCandidate.dv ?? s.dv,
      contactName: importCandidate.contactName ?? importCandidate.name ?? s.contactName,
      email: importCandidate.email ?? s.email,
      intlDialCode: importCandidate.intlDialCode ?? s.intlDialCode,
      mobile: importCandidate.mobile ?? s.mobile,
      landline: importCandidate.landline ?? s.landline,
      extension: importCandidate.extension ?? s.extension,
      address: importCandidate.address ?? s.address,
      city: importCandidate.city ?? s.city,
      department: importCandidate.department ?? s.department,
      isActive: Boolean(importCandidate.isActive ?? s.isActive),
    }));

    setImportPromptOpen(false);
    setImportCandidate(null);
    setImportMessage("");
    toast.success("Datos importados desde otro módulo");
  };

  const submit = async () => {
    if (submitting) return;

    const parsed = confectionistSchema.safeParse(form);

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues)
        next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);

      return;
    }

    setErrors({});

    const payload = {
      name: parsed.data.name,
      identificationType: parsed.data.identificationType,
      identification: parsed.data.identification,
      dv: form.dv.trim() || null,
      taxRegime: parsed.data.taxRegime,
      type: form.type.trim() || null,
      contactName: form.contactName.trim() || null,
      email: form.email.trim() || null,
      intlDialCode: form.intlDialCode.trim() || "57",
      mobile: form.mobile.trim() || null,
      fullMobile: form.mobile.trim()
        ? `+${form.intlDialCode} ${form.mobile}`
        : null,
      landline: form.landline.trim() || null,
      extension: form.extension.trim() || null,
      address: parsed.data.address,
      postalCode: form.postalCode.trim() || null,
      country: form.country.trim() || "COLOMBIA",
      department: form.department.trim() || "ANTIOQUIA",
      city: form.city.trim() || "Medellín",
      isActive: Boolean(parsed.data.isActive ?? true),
    };

    try {
      setSubmitting(true);
      await apiJson(`/api/confectionists`, {
        method: confectionist ? "PUT" : "POST",
        body: JSON.stringify(
          confectionist ? { id: confectionist.id, ...payload } : payload,
        ),
      });

      toast.success(
        confectionist ? "Confeccionista actualizado" : "Confeccionista creado",
      );
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
          <span>{confectionist ? "Editar confeccionista" : "Crear confeccionista"}</span>
          {confectionist?.confectionistCode && (
            <span className="font-mono text-xs font-normal text-primary">
              {confectionist.confectionistCode}
            </span>
          )}
        </ModalHeader>
        <ModalBody>
          <Input
            errorMessage={errors.name}
            isInvalid={Boolean(errors.name)}
            label="Nombre"
            value={form.name}
            onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              errorMessage={errors.identificationType}
              isInvalid={Boolean(errors.identificationType)}
              label="Tipo de identificación"
              selectedKeys={form.identificationType ? [form.identificationType] : []}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];
                setForm((s) => ({ ...s, identificationType: String(first ?? "") }));
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
              onValueChange={(v) => setForm((s) => ({ ...s, identification: v }))}
            />

            <Input
              label="Dígito verificación"
              maxLength={1}
              value={form.dv}
              onValueChange={(v) => setForm((s) => ({ ...s, dv: v }))}
            />

            <Select
              errorMessage={errors.taxRegime}
              isInvalid={Boolean(errors.taxRegime)}
              label="Régimen fiscal"
              selectedKeys={form.taxRegime ? [form.taxRegime] : []}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];
                setForm((s) => ({ ...s, taxRegime: String(first ?? "") }));
              }}
            >
              <SelectItem key="REGIMEN_COMUN">Régimen común</SelectItem>
              <SelectItem key="REGIMEN_SIMPLIFICADO">Régimen simplificado</SelectItem>
              <SelectItem key="NO_RESPONSABLE">No responsable</SelectItem>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="Tipo de taller"
              placeholder="Ej: Taller Externo, Sastrería"
              value={form.type}
              onValueChange={(v) => setForm((s) => ({ ...s, type: v }))}
            />

            <Input
              label="Nombre de contacto"
              value={form.contactName}
              onValueChange={(v) => setForm((s) => ({ ...s, contactName: v }))}
            />

            <Input
              label="Correo"
              type="email"
              value={form.email}
              onValueChange={(v) => setForm((s) => ({ ...s, email: v }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="Código internacional"
              placeholder="57"
              value={form.intlDialCode}
              onValueChange={(v) => setForm((s) => ({ ...s, intlDialCode: v }))}
            />

            <Input
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
              label="Extensión"
              value={form.extension}
              onValueChange={(v) => setForm((s) => ({ ...s, extension: v }))}
            />
          </div>

          <Input
            errorMessage={errors.address}
            isInvalid={Boolean(errors.address)}
            label="Dirección"
            value={form.address}
            onValueChange={(v) => setForm((s) => ({ ...s, address: v }))}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="Código postal"
              value={form.postalCode}
              onValueChange={(v) => setForm((s) => ({ ...s, postalCode: v }))}
            />

            <Input
              label="País"
              value={form.country}
              onValueChange={(v) => setForm((s) => ({ ...s, country: v }))}
            />

            <Input
              label="Departamento"
              value={form.department}
              onValueChange={(v) => setForm((s) => ({ ...s, department: v }))}
            />

            <Input
              label="Ciudad"
              value={form.city}
              onValueChange={(v) => setForm((s) => ({ ...s, city: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Activo</span>
            <Switch
              isSelected={form.isActive}
              onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
            />
          </div>
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
            {confectionist ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>

      <ConfirmActionModal
        cancelLabel="No importar"
        confirmColor="primary"
        confirmLabel="Importar datos"
        description={
          importMessage ||
          "Esta identificación ya existe en otro módulo. ¿Deseas importar esos datos?"
        }
        isOpen={importPromptOpen}
        title="Identificación encontrada"
        onConfirm={importFromOtherModule}
        onOpenChange={(open) => {
          if (!open) {
            setImportCandidate(null);
            setImportMessage("");
          }
          setImportPromptOpen(open);
        }}
      />
    </Modal>
  );
}
