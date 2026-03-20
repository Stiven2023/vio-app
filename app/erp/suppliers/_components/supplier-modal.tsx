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

import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
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
import {
  SupplierContactSection,
  SupplierCreditSection,
  SupplierIdentificationSection,
  SupplierLocationSection,
  SupplierPhonesSection,
} from "./supplier-modal-sections";

const identificationTypes = [
  { value: "CC", label: "C├®dula de Ciudadan├¡a" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "C├®dula de Extranjer├¡a" },
  { value: "PAS", label: "Pasaporte" },
  { value: "EMPRESA_EXTERIOR", label: "Empresa Exterior" },
];

const taxRegimes = [
  { value: "REGIMEN_COMUN", label: "R├®gimen Com├║n" },
  { value: "REGIMEN_SIMPLIFICADO", label: "R├®gimen Simplificado" },
  { value: "NO_RESPONSABLE", label: "No Responsable" },
];

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  identificationType: z.string().min(1, "Tipo de identificaci├│n requerido"),
  identification: z.string().trim().min(1, "Identificaci├│n requerida"),
  dv: z.string().optional(),
  branch: z.string(),
  taxRegime: z.string().min(1, "R├®gimen fiscal requerido"),
  contactName: z.string().trim().min(1, "Nombre de contacto requerido"),
  email: z.string().trim().email("Email inv├ílido"),
  address: z.string().trim().min(1, "Direcci├│n requerida"),
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
  bankCertificateUrl: z.string().optional(),
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
    city: "Medell├¡n",
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
    isActive: false,
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
        city: supplier.city ?? "Medell├¡n",
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
        isActive: supplier.isActive ?? false,
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
        city: prefill.city ?? "Medell├¡n",
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
        city: "Medell├¡n",
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
        isActive: false,
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
          identification: result.sameModule?.message ?? "Duplicate identification",
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
      // The backend validates again on save.
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
      isActive: false,
    }));

    setImportPromptOpen(false);
    setImportCandidate(null);
    setImportMessage("");
    toast.success("Data imported from another module");
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

    if (!isIdentificationValidByType(form.identificationType, form.identification)) {
      const typeLabel =
        identificationTypes.find((t) => t.value === form.identificationType)?.label ||
        form.identificationType;
      const formatMessages: Record<string, string> = {
        CC: "National ID must be 6-10 digits",
        NIT: "NIT must be 8-12 digits",
        CE: "Foreign ID must be 5-15 alphanumeric characters",
        PAS: "Passport must be 5-20 alphanumeric characters",
        EMPRESA_EXTERIOR: "Foreign company ID must be at least 3 characters",
      };
      const message =
        formatMessages[form.identificationType] || `Invalid format for ${typeLabel}`;
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
      isActive: false,
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

      toast.success(supplier ? "Supplier updated" : "Supplier created");
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
        <ModalHeader className="flex justify-between items-start">
          <div>
            <div>{supplier ? "Edit supplier" : "Create supplier"}</div>
            <p className="mt-1 text-xs font-normal text-default-500">
              Fields marked with <span className="text-danger">*</span> are
              required
            </p>
            {supplier?.supplierCode && (
              <span className="mt-1 block font-mono text-xs font-normal text-primary">
                {supplier.supplierCode}
              </span>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
          <Tabs aria-label="Form sections" variant="underlined">
            <Tab
              key="identificacion"
              title={<FormTabTitle icon={<IdentificationIcon />} label="Identification" />}
            >
              <SupplierIdentificationSection
                errors={errors}
                form={form}
                identificationTypes={identificationTypes}
                onIdentificationInputChange={onIdentificationInputChange}
                onStringFieldChange={onStringFieldChange}
              />

              <div className="space-y-4 border-t border-default-200 pt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Documents
                </h3>

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

                <FileUpload
                  acceptedFileTypes=".pdf"
                  errorMessage={errors.bankCertificateUrl}
                  label="Bank certificate"
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

            <Tab
              key="contacto"
              title={<FormTabTitle icon={<ContactIcon />} label="Contact and tax" />}
            >
              <SupplierContactSection
                errors={errors}
                form={form}
                taxRegimes={taxRegimes}
                onStringFieldChange={onStringFieldChange}
              />
            </Tab>

            <Tab
              key="ubicacion"
              title={<FormTabTitle icon={<LocationIcon />} label="Location" />}
            >
              <SupplierLocationSection
                errors={errors}
                form={form}
                onStringFieldChange={onStringFieldChange}
              />
            </Tab>

            <Tab
              key="telefonos"
              title={<FormTabTitle icon={<PhoneIcon />} label="Phones" />}
            >
              <SupplierPhonesSection
                errors={errors}
                form={form}
                onStringFieldChange={onStringFieldChange}
              />
            </Tab>

            <Tab
              key="credito"
              title={<FormTabTitle icon={<FinanceIcon />} label="Status and credit" />}
            >
              <SupplierCreditSection
                errors={errors}
                form={form}
                onBooleanFieldChange={onBooleanFieldChange}
                onStringFieldChange={onStringFieldChange}
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
            Cancel
          </Button>
          <Button color="primary" isLoading={submitting} onPress={submit}>
            {supplier ? "Save" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>

      <ConfirmActionModal
        cancelLabel="Do not import"
        confirmColor="primary"
        confirmLabel="Import data"
        description={
          importMessage ||
          "This identification already exists in another module. Import that data?"
        }
        isOpen={importPromptOpen}
        title="Identification found"
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
