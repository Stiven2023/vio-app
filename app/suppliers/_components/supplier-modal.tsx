"use client";

import type { Supplier } from "./suppliers-tab";
import type { SupplierFormPrefill } from "@/app/api/suppliers/supplier-modal.types";

import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
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
import { FileUpload } from "@/components/file-upload";
import { getMissingRequiredDocumentMessage } from "@/src/utils/identification-document-rules";
import {
  SupplierContactSection,
  SupplierCreditSection,
  SupplierIdentificationSection,
  SupplierLocationSection,
  SupplierPhonesSection,
} from "./supplier-modal-sections";

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
  bankCertificateUrl: z
    .string()
    .trim()
    .min(1, "Comprobante bancario requerido"),
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
  bankCertificateUrl: string;
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
    bankCertificateUrl: "",
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
        bankCertificateUrl: supplier.bankCertificateUrl ?? "",
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
        bankCertificateUrl: "",
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
        bankCertificateUrl: "",
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

    if (!form.bankCertificateUrl.trim()) {
      const msg = "Comprobante bancario requerido";
      setErrors((prev) => ({ ...prev, bankCertificateUrl: msg }));
      toast.error(msg);
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
      bankCertificateUrl: form.bankCertificateUrl || null,
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

  const onStringFieldChange = (field: keyof FormState, value: string) => {
    setForm((state) => ({ ...state, [field]: value }));
  };

  const onBooleanFieldChange = (field: keyof FormState, value: boolean) => {
    setForm((state) => ({ ...state, [field]: value }));
  };

  const onIdentificationInputChange = (value: string) => {
    setForm((state) => ({ ...state, identification: value }));

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      checkIdentification();
    }, 500);
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
              <SupplierIdentificationSection
                errors={errors}
                form={form}
                identificationTypes={identificationTypes}
                taxRegimes={taxRegimes}
                onIdentificationInputChange={onIdentificationInputChange}
                onStringFieldChange={onStringFieldChange}
              />
            </Tab>

            <Tab
              key="contacto"
              title={<FormTabTitle icon={<ContactIcon />} label="Contacto" />}
            >
              <SupplierContactSection
                errors={errors}
                form={form}
                onStringFieldChange={onStringFieldChange}
              />
            </Tab>

            <Tab
              key="ubicacion"
              title={<FormTabTitle icon={<LocationIcon />} label="Ubicación" />}
            >
              <SupplierLocationSection
                errors={errors}
                form={form}
                onStringFieldChange={onStringFieldChange}
              />
            </Tab>

            <Tab
              key="telefonos"
              title={<FormTabTitle icon={<PhoneIcon />} label="Teléfonos" />}
            >
              <SupplierPhonesSection
                errors={errors}
                form={form}
                onStringFieldChange={onStringFieldChange}
              />
            </Tab>

            <Tab
              key="credito"
              title={<FormTabTitle icon={<FinanceIcon />} label="Crédito y estado" />}
            >
              <SupplierCreditSection
                errors={errors}
                form={form}
                onBooleanFieldChange={onBooleanFieldChange}
                onStringFieldChange={onStringFieldChange}
              />
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
              <div className="pt-4">
                <FileUpload
                  acceptedFileTypes=".pdf"
                  errorMessage={errors.bankCertificateUrl}
                  isRequired
                  label="Comprobante bancario"
                  maxSizeMB={10}
                  uploadFolder="suppliers/documents"
                  value={form.bankCertificateUrl}
                  onChange={(url) =>
                    setForm((s) => ({ ...s, bankCertificateUrl: url }))
                  }
                  onClear={() =>
                    setForm((s) => ({ ...s, bankCertificateUrl: "" }))
                  }
                />
              </div>
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
