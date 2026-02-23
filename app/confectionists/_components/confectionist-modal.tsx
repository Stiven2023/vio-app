"use client";

import type { Confectionist } from "./confectionists-tab";
import type { ConfectionistFormPrefill } from "./confectionist-modal.types";

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
import { FormTabTitle, IdentificationIcon, ContactIcon, PhoneIcon, LocationIcon } from "@/components/form-tab-title";
import { IdentificationDocumentsSection } from "@/components/identification-documents-section";
import {
  ConfectionistContactSection,
  ConfectionistIdentificationSection,
  ConfectionistLocationSection,
  ConfectionistPhoneSection,
  type ConfectionistSectionsFormState,
} from "./confectionist-modal-sections";

const identificationTypes = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PAS", label: "Pasaporte" },
  { value: "EMPRESA_EXTERIOR", label: "Empresa Exterior" },
];

const confectionistSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  identificationType: z.string().trim().min(1, "Tipo de identificación requerido"),
  identification: z.string().trim().min(1, "Identificación requerida"),
  dv: z.string().trim().optional(),
  taxRegime: z.string().trim().min(1, "Régimen fiscal requerido"),
  address: z.string().trim().min(1, "Dirección requerida"),
  type: z.string().trim().optional(),
  specialty: z.string().trim().optional(),
  dailyCapacity: z.string().optional(),
  contactName: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Email inválido"),
  intlDialCode: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  fullMobile: z.string().trim().optional(),
  landline: z.string().trim().optional(),
  extension: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  department: z.string().trim().optional(),
  city: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

type FormState = ConfectionistSectionsFormState;

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
    taxRegime: "REGIMEN_COMUN",
    type: "",
    specialty: "",
    dailyCapacity: "",
    contactName: "",
    email: "",
    intlDialCode: "57",
    mobile: "",
    fullMobile: "",
    landline: "",
    extension: "",
    address: "",
    postalCode: "",
    country: "COLOMBIA",
    department: "ANTIOQUIA",
    city: "Medellín",
    isActive: false,
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

  const handleStringFieldChange = (
    field: keyof FormState,
    value: string,
  ) => {
    setForm((state) => ({ ...state, [field]: value }));
  };

  const handleIdentificationInputChange = (value: string) => {
    handleStringFieldChange("identification", value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      checkIdentification();
    }, 500);
  };

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
        specialty: "",
        dailyCapacity: "",
        contactName: prefill.contactName,
        email: prefill.email,
        intlDialCode: prefill.intlDialCode,
        mobile: prefill.mobile,
        fullMobile: prefill.mobile ? `+${prefill.intlDialCode} ${prefill.mobile}` : "",
        landline: prefill.landline,
        extension: prefill.extension,
        address: prefill.address,
        postalCode: prefill.postalCode,
        country: prefill.country,
        department: prefill.department,
        city: prefill.city,
        isActive: false,
        identityDocumentUrl: "",
        rutDocumentUrl: "",
        commerceChamberDocumentUrl: "",
        passportDocumentUrl: "",
        taxCertificateDocumentUrl: "",
        companyIdDocumentUrl: "",
      });
    } else {
      setForm({
        name: confectionist?.name ?? "",
        identificationType: confectionist?.identificationType ?? "",
        identification: confectionist?.identification ?? "",
        dv: confectionist?.dv ?? "",
        taxRegime: confectionist?.taxRegime ?? "",
        type: confectionist?.type ?? "",
        specialty: confectionist?.specialty ?? "",
        dailyCapacity:
          confectionist?.dailyCapacity === null || confectionist?.dailyCapacity === undefined
            ? ""
            : String(confectionist.dailyCapacity),
        contactName: confectionist?.contactName ?? "",
        email: confectionist?.email ?? "",
        intlDialCode: confectionist?.intlDialCode ?? "57",
        mobile: confectionist?.mobile ?? "",
        fullMobile: confectionist?.fullMobile ?? "",
        landline: confectionist?.landline ?? "",
        extension: confectionist?.extension ?? "",
        address: confectionist?.address ?? "",
        postalCode: confectionist?.postalCode ?? "",
        country: confectionist?.country ?? "COLOMBIA",
        department: confectionist?.department ?? "ANTIOQUIA",
        city: confectionist?.city ?? "Medellín",
        isActive: Boolean(confectionist?.isActive ?? false),
        identityDocumentUrl: confectionist?.identityDocumentUrl ?? "",
        rutDocumentUrl: confectionist?.rutDocumentUrl ?? "",
        commerceChamberDocumentUrl:
          confectionist?.commerceChamberDocumentUrl ?? "",
        passportDocumentUrl: confectionist?.passportDocumentUrl ?? "",
        taxCertificateDocumentUrl:
          confectionist?.taxCertificateDocumentUrl ?? "",
        companyIdDocumentUrl: confectionist?.companyIdDocumentUrl ?? "",
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
      isActive: false,
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
      specialty: form.specialty.trim() || null,
      dailyCapacity: form.dailyCapacity.trim() ? Number(form.dailyCapacity) : null,
      contactName: form.contactName.trim() || null,
      email: form.email.trim() || null,
      intlDialCode: form.intlDialCode.trim() || "57",
      mobile: form.mobile.trim() || null,
      fullMobile: form.mobile.trim()
        ? `+${form.intlDialCode.trim() || "57"} ${form.mobile.trim()}`
        : null,
      landline: form.landline.trim() || null,
      extension: form.extension.trim() || null,
      address: parsed.data.address,
      postalCode: form.postalCode.trim() || null,
      country: form.country.trim() || "COLOMBIA",
      department: form.department.trim() || "ANTIOQUIA",
      city: form.city.trim() || "Medellín",
      isActive: false,
      identityDocumentUrl: form.identityDocumentUrl || null,
      rutDocumentUrl: form.rutDocumentUrl || null,
      commerceChamberDocumentUrl: form.commerceChamberDocumentUrl || null,
      passportDocumentUrl: form.passportDocumentUrl || null,
      taxCertificateDocumentUrl: form.taxCertificateDocumentUrl || null,
      companyIdDocumentUrl: form.companyIdDocumentUrl || null,
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
    <Modal
      isOpen={isOpen && !importPromptOpen}
      scrollBehavior="inside"
      size="3xl"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        <ModalHeader>{confectionist ? "Editar confeccionista" : "Crear confeccionista"}</ModalHeader>
        <ModalBody>
          <Tabs aria-label="Formulario de confeccionista" variant="underlined">
            <Tab
              key="identificacion"
              title={<FormTabTitle icon={<IdentificationIcon />} label="Identificación" />}
            >
              <ConfectionistIdentificationSection
                errors={errors}
                form={form}
                identificationTypes={identificationTypes}
                onActiveChange={(value) => setForm((state) => ({ ...state, isActive: value }))}
                onIdentificationInputChange={handleIdentificationInputChange}
                onStringFieldChange={handleStringFieldChange}
              />
            </Tab>

            <Tab
              key="contacto"
              title={<FormTabTitle icon={<ContactIcon />} label="Contacto" />}
            >
              <ConfectionistContactSection
                errors={errors}
                form={form}
                identificationTypes={identificationTypes}
                onActiveChange={(value) => setForm((state) => ({ ...state, isActive: value }))}
                onIdentificationInputChange={handleIdentificationInputChange}
                onStringFieldChange={handleStringFieldChange}
              />
            </Tab>

            <Tab
              key="telefonos"
              title={<FormTabTitle icon={<PhoneIcon />} label="Teléfonos" />}
            >
              <ConfectionistPhoneSection
                errors={errors}
                form={form}
                identificationTypes={identificationTypes}
                onActiveChange={(value) => setForm((state) => ({ ...state, isActive: value }))}
                onIdentificationInputChange={handleIdentificationInputChange}
                onStringFieldChange={handleStringFieldChange}
              />
            </Tab>

            <Tab
              key="ubicacion"
              title={<FormTabTitle icon={<LocationIcon />} label="Ubicación" />}
            >
              <ConfectionistLocationSection
                errors={errors}
                form={form}
                identificationTypes={identificationTypes}
                onActiveChange={(value) => setForm((state) => ({ ...state, isActive: value }))}
                onIdentificationInputChange={handleIdentificationInputChange}
                onStringFieldChange={handleStringFieldChange}
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
                uploadFolder="confectionists/documents"
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
