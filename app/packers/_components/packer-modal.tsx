"use client";

import type { Packer } from "./packers-tab";

import { useEffect, useState, useRef } from "react";
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
import { Tab, Tabs } from "@heroui/tabs";
import { z } from "zod";

import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import {
  ContactIcon,
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

const packerSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  identificationType: z.string().trim().min(1, "Tipo de identificación requerido"),
  identification: z.string().trim().min(1, "Identificación requerida"),
  address: z.string().trim().min(1, "Dirección requerida"),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Email inválido"),
  dailyCapacity: z.string().optional(),
});

type FormState = {
  name: string;
  identificationType: string;
  identification: string;
  dv: string;
  packerType: string;
  specialty: string;
  contactName: string;
  email: string;
  intlDialCode: string;
  mobile: string;
  fullMobile: string;
  landline: string;
  address: string;
  postalCode: string;
  city: string;
  department: string;
  dailyCapacity: string;
  isActive: boolean;
  identityDocumentUrl: string;
  rutDocumentUrl: string;
  commerceChamberDocumentUrl: string;
  passportDocumentUrl: string;
  taxCertificateDocumentUrl: string;
  companyIdDocumentUrl: string;
};

export function PackerModal({
  packer,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  packer: Packer | null;
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
    identificationType: "NIT",
    identification: "",
    dv: "",
    packerType: "",
    specialty: "",
    contactName: "",
    email: "",
    intlDialCode: "57",
    mobile: "",
    fullMobile: "",
    landline: "",
    address: "",
    postalCode: "",
    city: "Medellín",
    department: "ANTIOQUIA",
    dailyCapacity: "",
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
    setForm({
      name: packer?.name ?? "",
      identificationType: packer?.identificationType ?? "NIT",
      identification: packer?.identification ?? "",
      dv: packer?.dv ?? "",
      packerType: packer?.packerType ?? "",
      specialty: packer?.specialty ?? "",
      contactName: packer?.contactName ?? "",
      email: packer?.email ?? "",
      intlDialCode: packer?.intlDialCode ?? "57",
      mobile: packer?.mobile ?? "",
      fullMobile: packer?.fullMobile ?? "",
      landline: packer?.landline ?? "",
      address: packer?.address ?? "",
      postalCode: packer?.postalCode ?? "",
      city: packer?.city ?? "Medellín",
      department: packer?.department ?? "ANTIOQUIA",
      dailyCapacity:
        packer?.dailyCapacity === null || packer?.dailyCapacity === undefined
          ? ""
          : String(packer.dailyCapacity),
      isActive: Boolean(packer?.isActive ?? true),
      identityDocumentUrl: packer?.identityDocumentUrl ?? "",
      rutDocumentUrl: packer?.rutDocumentUrl ?? "",
      commerceChamberDocumentUrl: packer?.commerceChamberDocumentUrl ?? "",
      passportDocumentUrl: packer?.passportDocumentUrl ?? "",
      taxCertificateDocumentUrl: packer?.taxCertificateDocumentUrl ?? "",
      companyIdDocumentUrl: packer?.companyIdDocumentUrl ?? "",
    });
  }, [packer, isOpen]);

  const checkIdentification = async () => {
    const identification = form.identification.trim();
    if (!identification) return;

    try {
      const params = new URLSearchParams({
        identification,
        identificationType: form.identificationType,
        module: "packer",
      });

      if (packer?.id) params.set("excludeId", packer.id);

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

      if (!packer && result.otherModule) {
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

    const parsed = packerSchema.safeParse({
      name: form.name,
      identificationType: form.identificationType,
      identification: form.identification,
      address: form.address,
      email: form.email,
      dailyCapacity: form.dailyCapacity,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues)
        next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);

      return;
    }

    const missingDocumentError = getMissingRequiredDocumentMessage(
      form.identificationType,
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
      identificationType: form.identificationType,
      identification: parsed.data.identification,
      dv: form.dv.trim() ? form.dv.trim() : null,
      packerType: form.packerType.trim() ? form.packerType.trim() : null,
      specialty: form.specialty.trim() ? form.specialty.trim() : null,
      contactName: form.contactName.trim() ? form.contactName.trim() : null,
      email: form.email.trim() ? form.email.trim() : null,
      intlDialCode: form.intlDialCode.trim() ? form.intlDialCode.trim() : "57",
      mobile: form.mobile.trim() ? form.mobile.trim() : null,
      fullMobile: form.fullMobile.trim() ? form.fullMobile.trim() : null,
      landline: form.landline.trim() ? form.landline.trim() : null,
      address: parsed.data.address,
      postalCode: form.postalCode.trim() ? form.postalCode.trim() : null,
      city: form.city.trim() ? form.city.trim() : "Medellín",
      department: form.department.trim() ? form.department.trim() : "ANTIOQUIA",
      dailyCapacity: form.dailyCapacity.trim() ? Number(form.dailyCapacity) : null,
      isActive: form.isActive,
      identityDocumentUrl: form.identityDocumentUrl || null,
      rutDocumentUrl: form.rutDocumentUrl || null,
      commerceChamberDocumentUrl: form.commerceChamberDocumentUrl || null,
      passportDocumentUrl: form.passportDocumentUrl || null,
      taxCertificateDocumentUrl: form.taxCertificateDocumentUrl || null,
      companyIdDocumentUrl: form.companyIdDocumentUrl || null,
    };

    try {
      setSubmitting(true);
      await apiJson(`/api/packers`, {
        method: packer ? "PUT" : "POST",
        body: JSON.stringify(packer ? { id: packer.id, ...payload } : payload),
      });

      toast.success(packer ? "Empacador actualizado" : "Empacador creado");
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
        <ModalHeader>{packer ? "Editar empaque" : "Crear empaque"}</ModalHeader>
        <ModalBody>
          <Tabs aria-label="Formulario de empaque" variant="underlined">
            <Tab
              key="identificacion"
              title={<FormTabTitle icon={<IdentificationIcon />} label="Identificación" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-3">
                <Select
                  errorMessage={errors.identificationType}
                  isInvalid={Boolean(errors.identificationType)}
                  label="Tipo de identificación"
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
                    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = setTimeout(() => {
                      checkIdentification();
                    }, 500);
                  }}
                />

                <Input
                  label="DV"
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
                  errorMessage={errors.name}
                  isInvalid={Boolean(errors.name)}
                  label="Nombre"
                  value={form.name}
                  onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
                />

                <Input
                  label="Nombre de contacto"
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

                <Input
                  label="Tipo de empaque"
                  placeholder="Interno, Satélite, Distribuidora"
                  value={form.packerType}
                  onValueChange={(v) => setForm((s) => ({ ...s, packerType: v }))}
                />

                <Input
                  label="Especialidad"
                  placeholder="Prenda colgada, Caja master, Etiquetado"
                  value={form.specialty}
                  onValueChange={(v) => setForm((s) => ({ ...s, specialty: v }))}
                />

                <Input
                  label="Capacidad diaria"
                  placeholder="Unidades por día"
                  type="number"
                  value={form.dailyCapacity}
                  onValueChange={(v) => setForm((s) => ({ ...s, dailyCapacity: v }))}
                />
              </div>
            </Tab>

            <Tab
              key="telefonos"
              title={<FormTabTitle icon={<PhoneIcon />} label="Teléfonos" />}
            >
              <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
                <Input
                  label="Código internacional"
                  value={form.intlDialCode}
                  onValueChange={(v) => setForm((s) => ({ ...s, intlDialCode: v }))}
                />

                <Input
                  label="Móvil"
                  value={form.mobile}
                  onValueChange={(v) => setForm((s) => ({ ...s, mobile: v }))}
                />

                <Input
                  label="Móvil completo"
                  value={form.fullMobile}
                  onValueChange={(v) => setForm((s) => ({ ...s, fullMobile: v }))}
                />

                <Input
                  label="Teléfono fijo"
                  value={form.landline}
                  onValueChange={(v) => setForm((s) => ({ ...s, landline: v }))}
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
                  label="Código postal"
                  value={form.postalCode}
                  onValueChange={(v) => setForm((s) => ({ ...s, postalCode: v }))}
                />

                <Input
                  label="Ciudad"
                  value={form.city}
                  onValueChange={(v) => setForm((s) => ({ ...s, city: v }))}
                />

                <Input
                  label="Departamento"
                  value={form.department}
                  onValueChange={(v) => setForm((s) => ({ ...s, department: v }))}
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm">Activo</span>
                <Switch
                  isSelected={form.isActive}
                  onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                />
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
                uploadFolder="packers/documents"
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
          <Button isDisabled={submitting} variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" isLoading={submitting} onPress={submit}>
            {packer ? "Guardar" : "Crear"}
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
