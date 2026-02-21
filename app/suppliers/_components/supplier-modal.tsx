"use client";

import type { Supplier } from "./suppliers-tab";
import type { SupplierFormPrefill } from "@/app/api/suppliers/supplier-modal.types";

import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Checkbox } from "@heroui/checkbox";
import { Switch } from "@heroui/switch";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Tab, Tabs } from "@heroui/tabs";
import { z } from "zod";

import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import {
  ContactIcon,
  FinanceIcon,
  FormTabTitle,
  IdentificationIcon,
  LocationIcon,
  PhoneIcon,
} from "@/components/form-tab-title";
import { IdentificationDocumentsSection } from "@/components/identification-documents-section";
import { getMissingRequiredDocumentMessage } from "@/src/utils/identification-document-rules";

const identificationTypes = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PAS", label: "Pasaporte" },
  { value: "EMPRESA_EXTERIOR", label: "Empresa Exterior" },
];

const taxRegimes = [
  { value: "REGIMEN_COMUN", label: "Régimen Común" },
  { value: "REGIMEN_SIMPLIFICADO", label: "Régimen Simplificado" },
  { value: "NO_RESPONSABLE", label: "No Responsable" },
];

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  identificationType: z.string().min(1, "Tipo de identificación requerido"),
  identification: z.string().trim().min(1, "Identificación requerida"),
  dv: z.string().optional(),
  branch: z.string(),
  taxRegime: z.string().min(1, "Régimen fiscal requerido"),
  contactName: z.string().trim().min(1, "Nombre de contacto requerido"),
  email: z.string().trim().email("Email inválido"),
  address: z.string().trim().min(1, "Dirección requerida"),
  postalCode: z.string().optional(),
  country: z.string(),
  department: z.string(),
  city: z.string(),
  intlDialCode: z.string(),
  mobile: z.string().optional(),
  fullMobile: z.string().optional(),
  localDialCode: z.string().optional(),
  landline: z.string().optional(),
  extension: z.string().optional(),
  fullLandline: z.string().optional(),
  hasCredit: z.boolean().optional(),
  promissoryNoteNumber: z.string().optional(),
  promissoryNoteDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

type FormState = {
  name: string;
  identificationType: string;
  identification: string;
  dv: string;
  branch: string;
  taxRegime: string;
  contactName: string;
  email: string;
  address: string;
  postalCode: string;
  country: string;
  department: string;
  city: string;
  intlDialCode: string;
  mobile: string;
  fullMobile: string;
  localDialCode: string;
  landline: string;
  extension: string;
  fullLandline: string;
  hasCredit: boolean;
  promissoryNoteNumber: string;
  promissoryNoteDate: string;
  isActive: boolean;
  identityDocumentUrl: string;
  rutDocumentUrl: string;
  commerceChamberDocumentUrl: string;
  passportDocumentUrl: string;
  taxCertificateDocumentUrl: string;
  companyIdDocumentUrl: string;
};

export function SupplierModal({
  supplier,
  isOpen,
  onOpenChange,
  onSaved,
  prefill,
}: {
  supplier: Supplier | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  prefill?: SupplierFormPrefill;
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
    identificationType: "NIT",
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
    fullMobile: "",
    localDialCode: "",
    landline: "",
    extension: "",
    fullLandline: "",
    hasCredit: false,
    promissoryNoteNumber: "",
    promissoryNoteDate: "",
    isActive: true,
    identityDocumentUrl: "",
    rutDocumentUrl: "",
    commerceChamberDocumentUrl: "",
    passportDocumentUrl: "",
    taxCertificateDocumentUrl: "",
    companyIdDocumentUrl: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [importPromptOpen, setImportPromptOpen] = useState(false);
  const [importCandidate, setImportCandidate] = useState<ImportData | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setImportPromptOpen(false);
    setImportCandidate(null);
    setImportMessage("");

    if (supplier) {
      setForm({
        name: supplier.name ?? "",
        identificationType: supplier.identificationType ?? "NIT",
        identification: supplier.identification ?? "",
        dv: supplier.dv ?? "",
        branch: supplier.branch ?? "01",
        taxRegime: supplier.taxRegime ?? "REGIMEN_COMUN",
        contactName: supplier.contactName ?? "",
        email: supplier.email ?? "",
        address: supplier.address ?? "",
        postalCode: supplier.postalCode ?? "",
        country: supplier.country ?? "COLOMBIA",
        department: supplier.department ?? "ANTIOQUIA",
        city: supplier.city ?? "Medellín",
        intlDialCode: supplier.intlDialCode ?? "57",
        mobile: supplier.mobile ?? "",
        fullMobile: supplier.fullMobile ?? "",
        localDialCode: supplier.localDialCode ?? "",
        landline: supplier.landline ?? "",
        extension: supplier.extension ?? "",
        fullLandline: supplier.fullLandline ?? "",
        hasCredit: supplier.hasCredit ?? false,
        promissoryNoteNumber: supplier.promissoryNoteNumber ?? "",
        promissoryNoteDate: supplier.promissoryNoteDate ?? "",
        isActive: supplier.isActive ?? true,
        identityDocumentUrl: supplier.identityDocumentUrl ?? "",
        rutDocumentUrl: supplier.rutDocumentUrl ?? "",
        commerceChamberDocumentUrl: supplier.commerceChamberDocumentUrl ?? "",
        passportDocumentUrl: supplier.passportDocumentUrl ?? "",
        taxCertificateDocumentUrl: supplier.taxCertificateDocumentUrl ?? "",
        companyIdDocumentUrl: supplier.companyIdDocumentUrl ?? "",
      });
    } else if (prefill) {
      setForm((prev) => ({
        ...prev,
        name: prefill.name ?? "",
        identificationType: prefill.identificationType ?? "NIT",
        identification: prefill.identification ?? "",
        dv: prefill.dv ?? "",
        branch: prefill.branch ?? "01",
        taxRegime: prefill.taxRegime ?? "REGIMEN_COMUN",
        contactName: prefill.contactName ?? "",
        email: prefill.email ?? "",
        address: prefill.address ?? "",
        postalCode: prefill.postalCode ?? "",
        country: prefill.country ?? "COLOMBIA",
        department: prefill.department ?? "ANTIOQUIA",
        city: prefill.city ?? "Medellín",
        intlDialCode: prefill.intlDialCode ?? "57",
        mobile: prefill.mobile ?? "",
        fullMobile: prefill.fullMobile ?? "",
        localDialCode: prefill.localDialCode ?? "",
        landline: prefill.landline ?? "",
        extension: prefill.extension ?? "",
        fullLandline: prefill.fullLandline ?? "",
        hasCredit: prefill.hasCredit ?? false,
        promissoryNoteNumber: prefill.promissoryNoteNumber ?? "",
        promissoryNoteDate: prefill.promissoryNoteDate ?? "",
        identityDocumentUrl: "",
        rutDocumentUrl: "",
        commerceChamberDocumentUrl: "",
        passportDocumentUrl: "",
        taxCertificateDocumentUrl: "",
        companyIdDocumentUrl: "",
      }));
    } else {
      setForm({
        name: "",
        identificationType: "NIT",
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
        fullMobile: "",
        localDialCode: "",
        landline: "",
        extension: "",
        fullLandline: "",
        hasCredit: false,
        promissoryNoteNumber: "",
        promissoryNoteDate: "",
        isActive: true,
        identityDocumentUrl: "",
        rutDocumentUrl: "",
        commerceChamberDocumentUrl: "",
        passportDocumentUrl: "",
        taxCertificateDocumentUrl: "",
        companyIdDocumentUrl: "",
      });
    }
  }, [supplier, prefill, isOpen]);

  const checkIdentification = async () => {
    const identification = form.identification.trim();
    if (!identification) return;

    try {
      const params = new URLSearchParams({
        identification,
        identificationType: form.identificationType,
        module: "supplier",
      });

      if (supplier?.id) params.set("excludeId", supplier.id);

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

      if (!supplier && result.otherModule) {
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

  const isIdentificationValidByType = (identificationType: string, identification: string) => {
    const value = identification.trim();
    if (!value) return false;

    switch (identificationType) {
      case "CC":
        return /^\d{6,10}$/.test(value);
      case "NIT":
        return /^\d{8,12}$/.test(value);
      case "CE":
        return /^[A-Za-z0-9]{5,15}$/.test(value);
      case "PAS":
        return /^[A-Za-z0-9]{5,20}$/.test(value);
      case "EMPRESA_EXTERIOR":
        return value.length >= 3;
      default:
        return false;
    }
  };

  const submit = async () => {
    if (submitting) return;

    // Validar formato de identificación por tipo
    if (!isIdentificationValidByType(form.identificationType, form.identification)) {
      const typeLabel = identificationTypes.find((t) => t.value === form.identificationType)?.label || form.identificationType;
      const formatMessages: Record<string, string> = {
        CC: "La Cédula debe tener entre 6 y 10 dígitos",
        NIT: "El NIT debe tener entre 8 y 12 dígitos",
        CE: "La Cédula de Extranjería debe tener entre 5 y 15 caracteres alfanuméricos",
        PAS: "El Pasaporte debe tener entre 5 y 20 caracteres alfanuméricos",
        EMPRESA_EXTERIOR: "La identificación de empresa exterior debe tener al menos 3 caracteres",
      };
      const message = formatMessages[form.identificationType] || `Formato inválido para ${typeLabel}`;
      setErrors((prev) => ({ ...prev, identification: message }));
      toast.error(message);
      return;
    }

    const parsed = supplierSchema.safeParse({
      ...form,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues)
        next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);

      return;
    }

    const missingDocumentError = getMissingRequiredDocumentMessage(
      parsed.data.identificationType,
      form as unknown as Record<string, unknown>,
    );

    if (missingDocumentError) {
      setErrors((prev) => ({ ...prev, documents: missingDocumentError }));
      toast.error(missingDocumentError);
      return;
    }

    setErrors({});

    const payload = {
      name: parsed.data.name,
      identificationType: parsed.data.identificationType,
      identification: parsed.data.identification,
      dv: parsed.data.dv || null,
      branch: parsed.data.branch,
      taxRegime: parsed.data.taxRegime,
      contactName: parsed.data.contactName,
      email: parsed.data.email,
      address: parsed.data.address,
      postalCode: parsed.data.postalCode || null,
      country: parsed.data.country,
      department: parsed.data.department,
      city: parsed.data.city,
      intlDialCode: parsed.data.intlDialCode,
      mobile: parsed.data.mobile || null,
      fullMobile: parsed.data.fullMobile || null,
      localDialCode: parsed.data.localDialCode || null,
      landline: parsed.data.landline || null,
      extension: parsed.data.extension || null,
      fullLandline: parsed.data.fullLandline || null,
      isActive: form.isActive,
      hasCredit: form.hasCredit,
      promissoryNoteNumber: parsed.data.promissoryNoteNumber || null,
      promissoryNoteDate: parsed.data.promissoryNoteDate || null,
      identityDocumentUrl: form.identityDocumentUrl || null,
      rutDocumentUrl: form.rutDocumentUrl || null,
      commerceChamberDocumentUrl: form.commerceChamberDocumentUrl || null,
      passportDocumentUrl: form.passportDocumentUrl || null,
      taxCertificateDocumentUrl: form.taxCertificateDocumentUrl || null,
      companyIdDocumentUrl: form.companyIdDocumentUrl || null,
    };

    try {
      setSubmitting(true);
      await apiJson(`/api/suppliers`, {
        method: supplier ? "PUT" : "POST",
        body: JSON.stringify(
          supplier ? { id: supplier.id, ...payload } : payload
        ),
      });

      toast.success(supplier ? "Proveedor actualizado" : "Proveedor creado");
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
      isOpen={isOpen && !importPromptOpen}
      onOpenChange={onOpenChange}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span>{supplier ? "Editar proveedor" : "Crear proveedor"}</span>
          {supplier?.supplierCode && (
            <span className="font-mono text-xs font-normal text-primary">
              {supplier.supplierCode}
            </span>
          )}
        </ModalHeader>
        <ModalBody>
          <Tabs aria-label="Formulario de proveedor" variant="underlined">
            <Tab
              key="identificacion"
              title={<FormTabTitle icon={<IdentificationIcon />} label="Identificación" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-3">
                <Select
                  errorMessage={errors.identificationType}
                  isInvalid={Boolean(errors.identificationType)}
                  label="Tipo de Identificación"
                  selectedKeys={[form.identificationType]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    setForm((s) => ({ ...s, identificationType: selected }));
                  }}
                >
                  {identificationTypes.map((type) => (
                    <SelectItem key={type.value}>{type.label}</SelectItem>
                  ))}
                </Select>

                <Input
                  errorMessage={errors.identification}
                  isInvalid={Boolean(errors.identification)}
                  label="Identificación"
                  value={form.identification}
                  onValueChange={(v) => {
                    setForm((s) => ({ ...s, identification: v }));
                    
                    // Debounce: buscar duplicados mientras escribe
                    if (debounceTimerRef.current) {
                      clearTimeout(debounceTimerRef.current);
                    }
                    
                    debounceTimerRef.current = setTimeout(() => {
                      checkIdentification();
                    }, 500);
                  }}
                />

                <Input
                  label="Dígito Verificación"
                  maxLength={1}
                  value={form.dv}
                  onValueChange={(v) => setForm((s) => ({ ...s, dv: v }))}
                />

                <Input
                  label="Sucursal"
                  value={form.branch}
                  onValueChange={(v) => setForm((s) => ({ ...s, branch: v }))}
                />

                <Select
                  errorMessage={errors.taxRegime}
                  isInvalid={Boolean(errors.taxRegime)}
                  label="Régimen Fiscal"
                  selectedKeys={[form.taxRegime]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    setForm((s) => ({ ...s, taxRegime: selected }));
                  }}
                >
                  {taxRegimes.map((regime) => (
                    <SelectItem key={regime.value}>{regime.label}</SelectItem>
                  ))}
                </Select>
              </div>
            </Tab>

            <Tab
              key="contacto"
              title={<FormTabTitle icon={<ContactIcon />} label="Contacto" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
                <Input
                  errorMessage={errors.name}
                  isInvalid={Boolean(errors.name)}
                  label="Nombre"
                  value={form.name}
                  onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
                />

                <Input
                  errorMessage={errors.contactName}
                  isInvalid={Boolean(errors.contactName)}
                  label="Nombre de Contacto"
                  value={form.contactName}
                  onValueChange={(v) => setForm((s) => ({ ...s, contactName: v }))}
                />

                <Input
                  errorMessage={errors.email}
                  isInvalid={Boolean(errors.email)}
                  label="Email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onValueChange={(v) => setForm((s) => ({ ...s, email: v }))}
                />
              </div>
            </Tab>

            <Tab
              key="ubicacion"
              title={<FormTabTitle icon={<LocationIcon />} label="Ubicación" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
                <Input
                  errorMessage={errors.address}
                  isInvalid={Boolean(errors.address)}
                  label="Dirección"
                  value={form.address}
                  onValueChange={(v) => setForm((s) => ({ ...s, address: v }))}
                />

                <Input
                  label="Código Postal"
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
            </Tab>

            <Tab
              key="telefonos"
              title={<FormTabTitle icon={<PhoneIcon />} label="Teléfonos" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
                <Input
                  label="Código Internacional"
                  value={form.intlDialCode}
                  onValueChange={(v) => setForm((s) => ({ ...s, intlDialCode: v }))}
                />

                <Input
                  label="Móvil"
                  value={form.mobile}
                  onValueChange={(v) => setForm((s) => ({ ...s, mobile: v }))}
                />

                <Input
                  label="Móvil Completo"
                  value={form.fullMobile}
                  onValueChange={(v) => setForm((s) => ({ ...s, fullMobile: v }))}
                />

                <Input
                  label="Código Local"
                  value={form.localDialCode}
                  onValueChange={(v) => setForm((s) => ({ ...s, localDialCode: v }))}
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

                <Input
                  label="Fijo Completo"
                  value={form.fullLandline}
                  onValueChange={(v) => setForm((s) => ({ ...s, fullLandline: v }))}
                />
              </div>
            </Tab>

            <Tab
              key="credito"
              title={<FormTabTitle icon={<FinanceIcon />} label="Crédito y estado" />}
            >
              <div className="space-y-4 pt-3">
                <div className="flex items-center justify-between">
                  <Checkbox
                    isSelected={form.hasCredit}
                    onValueChange={(v) => setForm((s) => ({ ...s, hasCredit: v }))}
                  >
                    Tiene Crédito
                  </Checkbox>

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-default-500">Activo</span>
                    <Switch
                      isSelected={form.isActive}
                      onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    label="Número Pagaré"
                    value={form.promissoryNoteNumber}
                    onValueChange={(v) => setForm((s) => ({ ...s, promissoryNoteNumber: v }))}
                  />

                  <Input
                    label="Fecha Firma Pagaré"
                    type="date"
                    value={form.promissoryNoteDate}
                    onValueChange={(v) => setForm((s) => ({ ...s, promissoryNoteDate: v }))}
                  />
                </div>
              </div>
            </Tab>

            <Tab
              key="documentos"
              title={<FormTabTitle icon={<IdentificationIcon />} label="Documentos" />}
            >
              <IdentificationDocumentsSection
                disabled={!form.identificationType}
                errors={errors}
                identificationType={form.identificationType}
                uploadFolder="suppliers/documents"
                values={form}
                onChange={(field, url) =>
                  setForm((s) => ({ ...s, [field]: url }))
                }
                onClear={(field) => setForm((s) => ({ ...s, [field]: "" }))}
              />
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
            {supplier ? "Guardar" : "Crear"}
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
