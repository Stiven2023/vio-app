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
import { BsShieldCheck } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createClientSchema } from "../../_lib/schemas";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { uploadFileToCldinary } from "@/components/file-upload";
import {
  ContactIcon,
  FinanceIcon,
  FormTabTitle,
  IdentificationIcon,
  LocationIcon,
  PhoneIcon,
} from "@/components/form-tab-title";
import { IdentificationTab } from "./client-modal-tabs/identification-tab";
import { ContactTab } from "./client-modal-tabs/contact-tab";
import { LocationTab } from "./client-modal-tabs/location-tab";
import { PhonesTab } from "./client-modal-tabs/phones-tab";
import { StatusCreditTab } from "./client-modal-tabs/status-credit-tab";
import { ClientLegalStatusModal } from "./client-legal-status-modal";

export function ClientModal({
  client,
  isOpen,
  prefill,
  onRequestCreateEmployee,
  onOpenChange,
  onSaved,
  canChangeLegalStatus = true,
}: {
  client: Client | null;
  isOpen: boolean;
  prefill?: ClientFormPrefill | null;
  onRequestCreateEmployee?: (prefill: EmployeeFormPrefill) => void;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  canChangeLegalStatus?: boolean;
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
    status: "INACTIVO",
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
  const [importCandidate, setImportCandidate] =
    useState<EmployeeImportData | null>(null);
  const [legalStatusModalOpen, setLegalStatusModalOpen] = useState(false);
  
  // Archivos pendientes de subir: { fieldName: File }
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});

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
      status: "INACTIVO",
      isActive: false,
      identityDocumentUrl: "",
      rutDocumentUrl: "",
      commerceChamberDocumentUrl: "",
      passportDocumentUrl: "",
      taxCertificateDocumentUrl: "",
      companyIdDocumentUrl: "",
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
        isActive: Boolean(client.isActive ?? false),
        identityDocumentUrl: client.identityDocumentUrl ?? "",
        rutDocumentUrl: client.rutDocumentUrl ?? "",
        commerceChamberDocumentUrl: client.commerceChamberDocumentUrl ?? "",
        passportDocumentUrl: client.passportDocumentUrl ?? "",
        taxCertificateDocumentUrl: client.taxCertificateDocumentUrl ?? "",
        companyIdDocumentUrl: client.companyIdDocumentUrl ?? "",
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
      isActive: false,
      status: "INACTIVO",
    }));

    setImportPromptOpen(false);
    setImportCandidate(null);
    toast.success("Datos importados desde empleados");
  };

  // Manejar archivos pendientes de subida
  const handleFileSelect = (fieldName: string, file: File) => {
    setPendingFiles((prev) => ({ ...prev, [fieldName]: file }));
  };

  // Mapa de abreviaciones para documentos
  const documentAbbreviations: Record<string, string> = {
    identityDocumentUrl: "ct", // cédula titular / representante
    rutDocumentUrl: "rut",
    commerceChamberDocumentUrl: "cc", // cámara comercio
    passportDocumentUrl: "ppt",
    taxCertificateDocumentUrl: "ctrib", // certificado tributario
    companyIdDocumentUrl: "ide", // ID empresa
  };

  // Subir todos los archivos pendientes antes de guardar
  const uploadPendingFiles = async (): Promise<Record<string, string>> => {
    const uploadedUrls: Record<string, string> = {};
    
    // Si es edición, usar el clientCode del cliente existente
    // Si es creación, usar la identification limpia
    const fileNameBase = client 
      ? client.clientCode 
      : form.identification.replace(/\D/g, ""); // Solo dígitos

    // En producción con Cloudinary:
    // Los documentos se guardarán en carpeta "clients/{identification}"
    // Ej: clients/1053123456
    const clientIdentification = form.identification.replace(/\D/g, "");
    const uploadFolder = `clients/${clientIdentification}`;

    for (const [fieldName, file] of Object.entries(pendingFiles)) {
      try {
        const abbr = documentAbbreviations[fieldName] || fieldName;
        const customFileName = `${fileNameBase}-${abbr}`; // Ejemplo: "CN10001-ct" o "1053123456-ct"
        
        const url = await uploadFileToCldinary(file, uploadFolder, customFileName);
        console.log(`✅ Subido ${fieldName} (${customFileName}):`, url);
        console.log(`📁 Guardado en carpeta: ${uploadFolder}`);
        uploadedUrls[fieldName] = url;
      } catch (error) {
        console.log(`❌ Error al subir ${fieldName}:`, error);
        throw new Error(`Error al subir ${fieldName}: ${error instanceof Error ? error.message : "Error desconocido"}`);
      }
    }

    console.log("📦 URLs subidas totales:", uploadedUrls);
    return uploadedUrls;
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      let updatedForm = { ...form };
      console.log("🔄 Iniciando envío de cliente...");
      console.log("📦 Pendientes para subir:", Object.keys(pendingFiles));

      // Primero, subir archivos pendientes
      if (Object.keys(pendingFiles).length > 0) {
        console.log("📤 Subiendo archivos pendientes...");
        toast.loading("Subiendo documentos...");
        try {
          const uploadedUrls = await uploadPendingFiles();
          console.log("✅ Archivos subidos:", uploadedUrls);
          
          // Actualizar formulario con las URLs de los archivos subidos
          updatedForm = {
            ...updatedForm,
            identityDocumentUrl: uploadedUrls.identityDocumentUrl || updatedForm.identityDocumentUrl,
            rutDocumentUrl: uploadedUrls.rutDocumentUrl || updatedForm.rutDocumentUrl,
            commerceChamberDocumentUrl: uploadedUrls.commerceChamberDocumentUrl || updatedForm.commerceChamberDocumentUrl,
            passportDocumentUrl: uploadedUrls.passportDocumentUrl || updatedForm.passportDocumentUrl,
            taxCertificateDocumentUrl: uploadedUrls.taxCertificateDocumentUrl || updatedForm.taxCertificateDocumentUrl,
            companyIdDocumentUrl: uploadedUrls.companyIdDocumentUrl || updatedForm.companyIdDocumentUrl,
          };
          
          console.log("📝 UpdatedForm después de URLs:", {
            identityDocumentUrl: updatedForm.identityDocumentUrl,
            rutDocumentUrl: updatedForm.rutDocumentUrl,
          });
          
          // Limpiar archivos pendientes en state
          setPendingFiles({});
          toast.dismiss();
        } catch (uploadError) {
          console.error("❌ Error subiendo archivos:", uploadError);
          setSubmitting(false);
          toast.dismiss();
          toast.error(uploadError instanceof Error ? uploadError.message : "Error al subir documentos");
          setErrors({ documents: uploadError instanceof Error ? uploadError.message : "Error al subir documentos" });
          return;
        }
      } else {
        console.log("✅ Sin archivos pendientes, continuando...");
      }

      console.log("✅ Validación de documentos completada");
      console.log("📋 Datos para crear cliente:", {
        name: updatedForm.name,
        identification: updatedForm.identification,
        identificationType: updatedForm.identificationType,
        email: updatedForm.email,
        mobile: updatedForm.mobile,
      });

      const parseData = {
        clientType: updatedForm.clientType,
        priceClientType: updatedForm.priceClientType,
        name: updatedForm.name,
        identificationType: updatedForm.identificationType,
        identification: updatedForm.identification,
        dv: updatedForm.dv || undefined,
        branch: updatedForm.branch || undefined,
        taxRegime: updatedForm.taxRegime,
        contactName: updatedForm.contactName,
        email: updatedForm.email?.trim() || undefined,
        address: updatedForm.address,
        postalCode: updatedForm.postalCode || undefined,
        country: updatedForm.country || undefined,
        department: updatedForm.department || undefined,
        city: updatedForm.city || undefined,
        intlDialCode: updatedForm.intlDialCode || undefined,
        mobile: updatedForm.mobile,
        localDialCode: updatedForm.localDialCode || undefined,
        landline: updatedForm.landline || undefined,
        extension: updatedForm.extension || undefined,
        hasCredit: updatedForm.hasCredit,
        promissoryNoteNumber: updatedForm.promissoryNoteNumber || undefined,
        promissoryNoteDate: updatedForm.promissoryNoteDate || undefined,
        status: "INACTIVO" as "ACTIVO" | "INACTIVO" | "SUSPENDIDO",
        isActive: false,
        identityDocumentUrl: updatedForm.identityDocumentUrl?.trim() || undefined,
        rutDocumentUrl: updatedForm.rutDocumentUrl?.trim() || undefined,
        commerceChamberDocumentUrl: updatedForm.commerceChamberDocumentUrl?.trim() || undefined,
        passportDocumentUrl: updatedForm.passportDocumentUrl?.trim() || undefined,
        taxCertificateDocumentUrl: updatedForm.taxCertificateDocumentUrl?.trim() || undefined,
        companyIdDocumentUrl: updatedForm.companyIdDocumentUrl?.trim() || undefined,
      };

      console.log("📝 Datos a parsear:", parseData);

      const parsed = createClientSchema.safeParse(parseData);

      if (!parsed.success) {
        const next: Record<string, string> = {};

        for (const issue of parsed.error.issues) {
          next[String(issue.path[0] ?? "form")] = issue.message;
        }
        
        console.error("❌ Error de validación del esquema:", next);
        console.error("Issues:", parsed.error.issues);
        
        setErrors(next);
        setSubmitting(false);
        toast.error("Por favor revisa los campos requeridos");
        return;
      }

      setErrors({});

      console.log("✅ Esquema validado correctamente");
      console.log("Enviando cliente con URLs:", {
        identityDocumentUrl: updatedForm.identityDocumentUrl,
        rutDocumentUrl: updatedForm.rutDocumentUrl,
        commerceChamberDocumentUrl: updatedForm.commerceChamberDocumentUrl,
        passportDocumentUrl: updatedForm.passportDocumentUrl,
        taxCertificateDocumentUrl: updatedForm.taxCertificateDocumentUrl,
        companyIdDocumentUrl: updatedForm.companyIdDocumentUrl,
      });

      console.log("📤 Enviando POST/PUT a /api/clients...");
      
      await apiJson(`/api/clients`, {
        method: client ? "PUT" : "POST",
        body: JSON.stringify(
          client ? { id: client.id, ...parsed.data } : parsed.data,
        ),
      });

      console.log("✅ Cliente guardado correctamente");

      // Actualizar el form state con el formulario actualizado
      setForm(updatedForm);
      toast.success(client ? "Cliente actualizado" : "Cliente creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      console.error("❌ Error al guardar cliente:", e);
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
        <ModalHeader className="flex justify-between items-start">
          <div>
            <div>{client ? "Editar cliente" : "Crear cliente"}</div>
            <p className="mt-1 text-xs font-normal text-default-500">
              Los campos marcados con <span className="text-danger">*</span> son
              críticos
            </p>
          </div>
          {client && (
            <Button
              isIconOnly
              color="default"
              variant="flat"
              size="sm"
              onPress={() => setLegalStatusModalOpen(true)}
              title="Ver estado jurídico"
            >
              <BsShieldCheck />
            </Button>
          )}
        </ModalHeader>
        <ModalBody>
          <Tabs aria-label="Secciones del formulario" variant="underlined">
            {/* TAB 1: IDENTIFICACIÓN */}
            <Tab
              key="identification"
              title={
                <FormTabTitle
                  icon={<IdentificationIcon />}
                  label="Identificación"
                />
              }
            >
              <IdentificationTab
                errors={errors}
                form={form}
                isEditing={Boolean(client)}
                onFileSelect={handleFileSelect}
                onIdentificationBlur={checkIdentification}
                setForm={setForm}
              />
            </Tab>

            {/* TAB 2: CONTACTO Y FISCAL */}
            <Tab
              key="contact"
              title={
                <FormTabTitle icon={<ContactIcon />} label="Contacto y fiscal" />
              }
            >
              <ContactTab errors={errors} form={form} setForm={setForm} />
            </Tab>

            {/* TAB 3: UBICACIÓN */}
            <Tab
              key="location"
              title={<FormTabTitle icon={<LocationIcon />} label="Ubicación" />}
            >
              <LocationTab errors={errors} form={form} setForm={setForm} />
            </Tab>

            {/* TAB 4: TELÉFONOS */}
            <Tab
              key="phones"
              title={<FormTabTitle icon={<PhoneIcon />} label="Teléfonos" />}
            >
              <PhonesTab errors={errors} form={form} setForm={setForm} />
            </Tab>

            {/* TAB 5: ESTADO Y CRÉDITO */}
            <Tab
              key="status-credit"
              title={
                <FormTabTitle
                  icon={<FinanceIcon />}
                  label="Estado y crédito"
                />
              }
            >
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

      <ClientLegalStatusModal
        canEdit={canChangeLegalStatus}
        client={client}
        isOpen={legalStatusModalOpen}
        onOpenChange={setLegalStatusModalOpen}
      />
    </Modal>
  );
}
