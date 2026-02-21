"use client";

import { useEffect, useState, useRef } from "react";

import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Tab, Tabs } from "@heroui/tabs";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/dropdown";
import { BsPersonFill, BsTrash, BsPlusCircle, BsEnvelope, BsKey, BsFillPersonBadgeFill } from "react-icons/bs";
import { Skeleton } from "@heroui/skeleton";
import { AlertToast } from "@/components/alert-toast";
import { FileUpload, uploadFileToCldinary } from "@/components/file-upload";

type RoleOption = { id: string; name: string };

export type InitialUser = { id: string; email: string };


type Beneficiary = {
  name: string;
  type: "HIJO" | "CONYUGE" | "PADRE";
  relationship: string;
  identityDocumentUrl: string;
  birthCertificateUrl: string;
};

type FormState = {
  // Identificación
  userId: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string;
  // Contacto
  email: string;
  intlDialCode: string;
  mobile: string;
  landline: string;
  extension: string;
  // Ubicación
  address: string;
  city: string;
  department: string;
  // Usuario y rol
  roleId: string;
  isActive: boolean;
  createUserEmail: string;
  createUserPassword: string;
  // Documentos del empleado
  identityDocumentUrl: string;
  hojaDeVidaUrl: string;
  certificadoLaboralUrl: string;
  certificadoEstudiosUrl: string;
  epsCertificateUrl: string;
  pensionCertificateUrl: string;
  bankCertificateUrl: string;
  // Beneficiarios
  beneficiaries: Beneficiary[];
};

export function EmployeeRegisterForm({
  initialUser,
  employeeId,
  onSuccess,
  submitLabel = "Registrar",
}: {
  initialUser?: InitialUser;
  employeeId?: string;
  onSuccess?: () => void;
  submitLabel?: string;
}) {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [form, setForm] = useState<FormState>({
    // Identificación
    userId: initialUser?.id ?? "",
    name: "",
    identificationType: "CC",
    identification: "",
    dv: "",
    // Contacto
    email: "",
    intlDialCode: "57",
    mobile: "",
    landline: "",
    extension: "",
    // Ubicación
    address: "",
    city: "Medellín",
    department: "ANTIOQUIA",
    // Usuario y rol
    roleId: "",
    isActive: true,
    createUserEmail: "",
    createUserPassword: "",
    // Documentos del empleado
    identityDocumentUrl: "",
    hojaDeVidaUrl: "",
    certificadoLaboralUrl: "",
    certificadoEstudiosUrl: "",
    epsCertificateUrl: "",
    pensionCertificateUrl: "",
    bankCertificateUrl: "",
    // Beneficiarios
    beneficiaries: [],
  });

  const [loading, setLoading] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  const [identificationError, setIdentificationError] = useState<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [pendingBeneficiaryFiles, setPendingBeneficiaryFiles] = useState<Record<string, File>>({});

  useEffect(() => {
    setForm((s) => ({
      ...s,
      userId: initialUser?.id ?? s.userId,
      email: initialUser?.email ?? s.email,
    }));
  }, [initialUser]);

  useEffect(() => {
    if (!employeeId) return;

    let cancelled = false;

    const loadEmployee = async () => {
      setLoadingEmployee(true);
      try {
        const res = await fetch(`/api/employees/${employeeId}/detail`, {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          if (!cancelled) {
            setToast({
              message: text || "No se pudo cargar el empleado.",
              type: "error",
            });
          }
          return;
        }

        const data = (await res.json()) as {
          employee?: Record<string, unknown>;
          user?: { id?: string; email?: string } | null;
        };

        if (cancelled || !data.employee) return;

        const employee = data.employee;

        setForm((s) => ({
          ...s,
          userId: String(employee.userId ?? data.user?.id ?? s.userId ?? ""),
          name: String(employee.name ?? ""),
          identificationType: String(employee.identificationType ?? "CC"),
          identification: String(employee.identification ?? ""),
          dv: String(employee.dv ?? ""),
          email: String(employee.email ?? data.user?.email ?? ""),
          intlDialCode: String(employee.intlDialCode ?? "57"),
          mobile: String(employee.mobile ?? ""),
          landline: String(employee.landline ?? ""),
          extension: String(employee.extension ?? ""),
          address: String(employee.address ?? ""),
          city: String(employee.city ?? "Medellín"),
          department: String(employee.department ?? "ANTIOQUIA"),
          roleId: String(employee.roleId ?? ""),
          isActive: Boolean(employee.isActive ?? true),
          identityDocumentUrl: String(employee.identityDocumentUrl ?? ""),
          hojaDeVidaUrl: String(employee.hojaDeVidaUrl ?? ""),
          certificadoLaboralUrl: String(employee.certificadoLaboralUrl ?? ""),
          certificadoEstudiosUrl: String(employee.certificadoEstudiosUrl ?? ""),
          epsCertificateUrl: String(employee.epsCertificateUrl ?? ""),
          pensionCertificateUrl: String(employee.pensionCertificateUrl ?? ""),
          bankCertificateUrl: String(employee.bankCertificateUrl ?? ""),
        }));
      } catch {
        if (!cancelled)
          setToast({
            message: "No se pudo cargar el empleado.",
            type: "error",
          });
      } finally {
        if (!cancelled) setLoadingEmployee(false);
      }
    };

    loadEmployee();

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingRoles(true);
      try {
        const res = await fetch("/api/roles?page=1&pageSize=100", {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();

          if (!cancelled) {
            setToast({
              message: text || "No se pudieron cargar los roles.",
              type: "error",
            });
            setRoles([]);
          }

          return;
        }

        const data = (await res.json()) as { items?: RoleOption[] };

        if (!cancelled) setRoles(data.items ?? []);
      } catch {
        if (!cancelled)
          setToast({
            message: "No se pudieron cargar los roles.",
            type: "error",
          });
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // Validaciones
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPassword = (pw: string) => pw.length >= 7 && /[A-Z]/.test(pw);
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

  const checkIdentificationUniqueness = async () => {
    const identification = form.identification.trim();
    if (!identification) {
      setIdentificationError("");
      return;
    }

    const params = new URLSearchParams({
      identification,
      identificationType: form.identificationType,
      module: "employee",
    });

    if (employeeId) params.set("excludeId", employeeId);

    try {
      const res = await fetch(`/api/registry/identification-check?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        setIdentificationError("");
        return;
      }

      const result = (await res.json()) as {
        sameModule?: { message?: string } | null;
        otherModule?: { message?: string } | null;
      };

      if (result.sameModule?.message) {
        setIdentificationError(result.sameModule.message);
      } else if (result.otherModule?.message) {
        setIdentificationError(result.otherModule.message);
      } else {
        setIdentificationError("");
      }
    } catch {
      setIdentificationError("");
    }
  };

  const handlePendingFileSelect = (fieldName: string, file: File) => {
    setPendingFiles((prev) => ({ ...prev, [fieldName]: file }));
  };

  const getBeneficiaryFileKey = (
    index: number,
    fieldName: "identityDocumentUrl" | "birthCertificateUrl",
  ) => `${index}:${fieldName}`;

  const handlePendingBeneficiaryFileSelect = (
    index: number,
    fieldName: "identityDocumentUrl" | "birthCertificateUrl",
    file: File,
  ) => {
    const key = getBeneficiaryFileKey(index, fieldName);
    setPendingBeneficiaryFiles((prev) => ({ ...prev, [key]: file }));
  };

  const removePendingBeneficiaryFile = (
    index: number,
    fieldName: "identityDocumentUrl" | "birthCertificateUrl",
  ) => {
    const key = getBeneficiaryFileKey(index, fieldName);
    setPendingBeneficiaryFiles((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const removeBeneficiaryAtIndex = (index: number) => {
    setForm((s) => ({
      ...s,
      beneficiaries: s.beneficiaries.filter((_, i) => i !== index),
    }));

    setPendingBeneficiaryFiles((prev) => {
      const next: Record<string, File> = {};
      Object.entries(prev).forEach(([key, file]) => {
        const [indexPart, fieldName] = key.split(":");
        const currentIndex = Number(indexPart);

        if (!Number.isFinite(currentIndex) || currentIndex === index) {
          return;
        }

        const targetIndex = currentIndex > index ? currentIndex - 1 : currentIndex;
        next[`${targetIndex}:${fieldName}`] = file;
      });
      return next;
    });
  };

  const removePendingFile = (fieldName: string) => {
    setPendingFiles((prev) => {
      const { [fieldName]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const documentAbbreviations: Record<string, string> = {
    identityDocumentUrl: "ced",
    hojaDeVidaUrl: "hv",
    certificadoLaboralUrl: "cl",
    certificadoEstudiosUrl: "ce",
    epsCertificateUrl: "eps",
    pensionCertificateUrl: "pen",
    bankCertificateUrl: "cb",
  };

  const uploadPendingFiles = async () => {
    const uploadedUrls: Record<string, string> = {};
    const baseIdentification = form.identification.replace(/\s+/g, "").trim();
    const uploadFolder = `employees/${baseIdentification || "documents"}`;

    for (const [fieldName, file] of Object.entries(pendingFiles)) {
      const abbr = documentAbbreviations[fieldName] || fieldName;
      const customFileName = `${baseIdentification || "employee"}-${abbr}`;
      const url = await uploadFileToCldinary(file, uploadFolder, customFileName);
      uploadedUrls[fieldName] = url;
    }

    return uploadedUrls;
  };

  const beneficiaryDocumentAbbreviations: Record<string, string> = {
    identityDocumentUrl: "idb",
    birthCertificateUrl: "rcn",
  };

  const uploadPendingBeneficiaryFiles = async (
    beneficiaries: Beneficiary[],
  ): Promise<Beneficiary[]> => {
    if (Object.keys(pendingBeneficiaryFiles).length === 0) return beneficiaries;

    const updatedBeneficiaries = beneficiaries.map((beneficiary) => ({ ...beneficiary }));
    const baseIdentification = form.identification.replace(/\s+/g, "").trim();
    const uploadFolder = `employees/${baseIdentification || "documents"}/beneficiaries`;

    for (const [key, file] of Object.entries(pendingBeneficiaryFiles)) {
      const [indexPart, fieldName] = key.split(":");
      const beneficiaryIndex = Number(indexPart);

      if (!Number.isFinite(beneficiaryIndex) || !updatedBeneficiaries[beneficiaryIndex]) {
        continue;
      }

      if (fieldName !== "identityDocumentUrl" && fieldName !== "birthCertificateUrl") {
        continue;
      }

      const abbr = beneficiaryDocumentAbbreviations[fieldName] || fieldName;
      const customFileName = `${baseIdentification || "employee"}-ben-${beneficiaryIndex + 1}-${abbr}`;
      const url = await uploadFileToCldinary(file, uploadFolder, customFileName);
      updatedBeneficiaries[beneficiaryIndex][fieldName] = url;
    }

    return updatedBeneficiaries;
  };

  const submit = async () => {
    const userId = form.userId?.trim();
    if (!userId) {
      setToast({ message: "Debes crear el usuario primero (correo).", type: "error" });
      return;
    }
    if (!form.name.trim()) {
      setToast({ message: "El nombre es obligatorio.", type: "error" });
      return;
    }
    if (!form.roleId.trim()) {
      setToast({ message: "El rol es obligatorio.", type: "error" });
      return;
    }
    if (!form.identificationType.trim()) {
      setToast({ message: "El tipo de identificación es obligatorio.", type: "error" });
      return;
    }
    if (!form.identification.trim()) {
      setToast({ message: "La identificación es obligatoria.", type: "error" });
      return;
    }
    if (!isIdentificationValidByType(form.identificationType, form.identification)) {
      setToast({
        message:
          form.identificationType === "CC"
            ? "La CC debe tener entre 6 y 10 dígitos."
            : form.identificationType === "NIT"
              ? "El NIT debe tener entre 8 y 12 dígitos."
              : form.identificationType === "CE"
                ? "La CE debe tener entre 5 y 15 caracteres alfanuméricos."
                : form.identificationType === "PAS"
                  ? "El pasaporte debe tener entre 5 y 20 caracteres alfanuméricos."
                  : "El identificador no cumple el formato requerido.",
        type: "error",
      });
      return;
    }

    // Validar que no hay error de identificación duplicada (ya validado con debounce)
    if (identificationError) {
      setToast({ message: identificationError, type: "error" });
      return;
    }

    if (!isValidEmail(form.email)) {
      setToast({ message: "El correo no es válido.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      let updatedForm = {
        ...form,
        beneficiaries: form.beneficiaries.map((beneficiary) => ({ ...beneficiary })),
      };

      if (Object.keys(pendingFiles).length > 0) {
        try {
          const uploadedUrls = await uploadPendingFiles();
          updatedForm = {
            ...updatedForm,
            identityDocumentUrl:
              uploadedUrls.identityDocumentUrl || updatedForm.identityDocumentUrl,
            hojaDeVidaUrl: uploadedUrls.hojaDeVidaUrl || updatedForm.hojaDeVidaUrl,
            certificadoLaboralUrl:
              uploadedUrls.certificadoLaboralUrl || updatedForm.certificadoLaboralUrl,
            certificadoEstudiosUrl:
              uploadedUrls.certificadoEstudiosUrl || updatedForm.certificadoEstudiosUrl,
            epsCertificateUrl:
              uploadedUrls.epsCertificateUrl || updatedForm.epsCertificateUrl,
            pensionCertificateUrl:
              uploadedUrls.pensionCertificateUrl || updatedForm.pensionCertificateUrl,
            bankCertificateUrl:
              uploadedUrls.bankCertificateUrl || updatedForm.bankCertificateUrl,
          };
          setPendingFiles({});
        } catch {
          setToast({ message: "No se pudieron subir los documentos.", type: "error" });
          return;
        }
      }

      if (Object.keys(pendingBeneficiaryFiles).length > 0) {
        try {
          const uploadedBeneficiaries = await uploadPendingBeneficiaryFiles(
            updatedForm.beneficiaries,
          );
          updatedForm = {
            ...updatedForm,
            beneficiaries: uploadedBeneficiaries,
          };
          setPendingBeneficiaryFiles({});
        } catch {
          setToast({ message: "No se pudieron subir los documentos de beneficiarios.", type: "error" });
          return;
        }
      }

      for (const b of updatedForm.beneficiaries) {
        if (!b.name.trim()) {
          setToast({ message: "Todos los beneficiarios deben tener nombre.", type: "error" });
          return;
        }
        if (!b.identityDocumentUrl) {
          setToast({ message: "Todos los beneficiarios deben tener documento de identidad.", type: "error" });
          return;
        }
        if (b.type === "HIJO" && !b.birthCertificateUrl) {
          setToast({ message: "El hijo beneficiario debe tener registro civil.", type: "error" });
          return;
        }
      }

      const res = await fetch("/api/employees", {
        method: employeeId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(employeeId ? { id: employeeId } : {}),
          userId,
          name: updatedForm.name.trim(),
          identificationType: updatedForm.identificationType,
          identification: updatedForm.identification.trim(),
          dv: updatedForm.dv.trim() || null,
          email: updatedForm.email.trim(),
          intlDialCode: updatedForm.intlDialCode.trim() || "57",
          mobile: updatedForm.mobile.trim() || null,
          landline: updatedForm.landline.trim() || null,
          extension: updatedForm.extension.trim() || null,
          address: updatedForm.address.trim() || null,
          city: updatedForm.city.trim() || "Medellín",
          department: updatedForm.department.trim() || "ANTIOQUIA",
          roleId: updatedForm.roleId,
          isActive: updatedForm.isActive,
          identityDocumentUrl: updatedForm.identityDocumentUrl,
          hojaDeVidaUrl: updatedForm.hojaDeVidaUrl,
          certificadoLaboralUrl: updatedForm.certificadoLaboralUrl,
          certificadoEstudiosUrl: updatedForm.certificadoEstudiosUrl,
          epsCertificateUrl: updatedForm.epsCertificateUrl,
          pensionCertificateUrl: updatedForm.pensionCertificateUrl,
          bankCertificateUrl: updatedForm.bankCertificateUrl,
          beneficiaries: updatedForm.beneficiaries,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setToast({
          message: text || "No se pudo registrar el empleado.",
          type: "error",
        });
        return;
      }
      setToast({
        message: employeeId ? "Empleado actualizado." : "Empleado registrado.",
        type: "success",
      });
      onSuccess?.();
    } catch {
      setToast({ message: "No se pudo registrar el empleado.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <AlertToast message={toast.message} type={toast.type} /> : null}
      {loadingEmployee || loadingRoles ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <Tabs aria-label="Formulario de empleado" variant="underlined">
          <Tab key="identificacion" title="Identificación">
            <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
              <Input
                label="Nombre"
                value={form.name}
                onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
              />
              <Select
                label="Tipo de identificación"
                selectedKeys={[form.identificationType]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  setForm((s) => ({ ...s, identificationType: String(first ?? "CC") }));
                }}
              >
                <SelectItem key="CC">Cédula de ciudadanía (CC)</SelectItem>
                <SelectItem key="NIT">NIT</SelectItem>
                <SelectItem key="CE">Cédula de extranjería (CE)</SelectItem>
                <SelectItem key="PAS">Pasaporte (PAS)</SelectItem>
                <SelectItem key="EMPRESA_EXTERIOR">Empresa exterior</SelectItem>
              </Select>
              <Input
                label="Identificación"
                value={form.identification}
                errorMessage={identificationError}
                isInvalid={Boolean(identificationError)}
                onValueChange={(v) => {
                  setForm((s) => ({ ...s, identification: v }));
                  setIdentificationError("");
                  
                  // Debounce: validar duplicados mientras escribe
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                  }
                  
                  debounceTimerRef.current = setTimeout(() => {
                    checkIdentificationUniqueness();
                  }, 500);
                }}
              />
              <Input
                label="Dígito verificación"
                maxLength={1}
                value={form.dv}
                onValueChange={(v) => setForm((s) => ({ ...s, dv: v }))}
              />
            </div>
          </Tab>
        <Tab key="contacto" title="Contacto">
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
        </Tab>
        <Tab key="ubicacion" title="Ubicación">
          <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
            <Input
              label="Dirección"
              value={form.address}
              onValueChange={(v) => setForm((s) => ({ ...s, address: v }))}
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
        </Tab>
        <Tab key="usuario-rol" title="Usuario y rol">
          <div className="space-y-4 pt-3">
            <Input
              label="Usuario (correo)"
              value={form.email}
              isDisabled
              startContent={<BsEnvelope className="text-xl text-default-500" />}
            />
            <p className="text-xs text-default-500">
              {form.userId
                ? "Usuario creado y asignado. Ya puedes registrar el empleado."
                : "Primero crea y asigna el usuario para habilitar el registro del empleado."}
            </p>
            <Dropdown isOpen={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
              <DropdownTrigger>
                <Button variant="flat">
                  Crear usuario
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Creador de usuario" closeOnSelect={false}>
                <DropdownItem key="creator" textValue="Creador de usuario">
                  <div className="w-[280px] space-y-2 py-1">
                    <Input
                      label="Email usuario"
                      placeholder="usuario@dominio.com"
                      type="text"
                      inputMode="email"
                      autoComplete="email"
                      value={form.createUserEmail}
                      onValueChange={(v) => setForm((s) => ({ ...s, createUserEmail: v }))}
                      startContent={<BsEnvelope className="text-xl text-default-500" />}
                      errorMessage={form.createUserEmail && !isValidEmail(form.createUserEmail) ? "Correo inválido" : undefined}
                      isInvalid={!!form.createUserEmail && !isValidEmail(form.createUserEmail)}
                    />
                    <Input
                      label="Contraseña"
                      placeholder="Mínimo 7, 1 mayúscula"
                      type="password"
                      value={form.createUserPassword}
                      onValueChange={(v) => setForm((s) => ({ ...s, createUserPassword: v }))}
                      startContent={<BsKey className="text-xl text-default-500" />}
                      errorMessage={form.createUserPassword && !isValidPassword(form.createUserPassword) ? "Debe tener mínimo 7 caracteres y 1 mayúscula" : undefined}
                      isInvalid={!!form.createUserPassword && !isValidPassword(form.createUserPassword)}
                    />
                    <Button
                      className="w-full mt-2"
                      color="primary"
                      isDisabled={!form.createUserEmail || !form.createUserPassword || creatingUser || !!employeeId}
                      isLoading={creatingUser}
                      onPress={async () => {
                        if (!isValidEmail(form.createUserEmail)) {
                          setToast({ message: "El correo del usuario no es válido.", type: "error" });
                          return;
                        }
                        if (!isValidPassword(form.createUserPassword)) {
                          setToast({
                            message: "La contraseña debe tener mínimo 7 caracteres y 1 mayúscula.",
                            type: "error",
                          });
                          return;
                        }

                        setCreatingUser(true);
                        try {
                          const res = await fetch("/api/users", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              email: form.createUserEmail,
                              password: form.createUserPassword,
                            }),
                          });
                          if (!res.ok) {
                            throw new Error(await res.text());
                          }
                          const data = (await res.json()) as unknown;
                          const createdUser = Array.isArray(data)
                            ? (data[0] as { id?: string; email?: string } | undefined)
                            : (data as { id?: string; email?: string } | undefined);

                          const createdUserId = createdUser?.id?.trim() ?? "";
                          const createdUserEmail = createdUser?.email?.trim() ?? form.createUserEmail.trim();

                          if (!createdUserId) {
                            throw new Error("No se recibió el id del usuario creado.");
                          }

                          setForm((s) => ({
                            ...s,
                            userId: createdUserId,
                            email: createdUserEmail,
                            createUserEmail: "",
                            createUserPassword: "",
                          }));
                          setToast({ message: "Usuario creado y asignado.", type: "success" });
                          setUserDropdownOpen(false);
                        } catch (e: unknown) {
                          const message = e instanceof Error ? e.message : "Error desconocido";
                          setToast({ message: `Error al crear usuario: ${message}`, type: "error" });
                        } finally {
                          setCreatingUser(false);
                        }
                      }}
                    >Crear y asignar</Button>
                    <p className="text-xs text-default-500">
                      Opcional. Si completas estos campos, se crea y asocia el usuario sin exigir verificación de email.
                    </p>
                  </div>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Select
              label="Rol"
              selectedKeys={form.roleId ? [form.roleId] : []}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];
                setForm((s) => ({ ...s, roleId: String(first ?? "") }));
              }}
              startContent={<BsFillPersonBadgeFill className="text-xl text-default-500" />}
            >
              {roles.map((r) => (
                <SelectItem key={r.id}>{r.name}</SelectItem>
              ))}
            </Select>
            <div className="flex items-center justify-between">
              <span className="text-sm">Activo</span>
              <Switch
                isDisabled={loading}
                isSelected={form.isActive}
                onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
              />
            </div>
          </div>
        </Tab>
        <Tab key="documentos" title="Documentos">
          {form.identificationType ? (
            <div className="space-y-4 pt-4">
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                isRequired
                label="Cédula"
                maxSizeMB={10}
                uploadFolder="employees/documents"
                value={form.identityDocumentUrl}
                onChange={(url) => setForm((s) => ({ ...s, identityDocumentUrl: url }))}
                onClear={() => {
                  setForm((s) => ({ ...s, identityDocumentUrl: "" }));
                  removePendingFile("identityDocumentUrl");
                }}
                onFileSelect={(file) => handlePendingFileSelect("identityDocumentUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                isRequired
                label="Hoja de vida"
                maxSizeMB={10}
                uploadFolder="employees/documents"
                value={form.hojaDeVidaUrl}
                onChange={(url) => setForm((s) => ({ ...s, hojaDeVidaUrl: url }))}
                onClear={() => {
                  setForm((s) => ({ ...s, hojaDeVidaUrl: "" }));
                  removePendingFile("hojaDeVidaUrl");
                }}
                onFileSelect={(file) => handlePendingFileSelect("hojaDeVidaUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                isRequired
                label="Certificado laboral"
                maxSizeMB={10}
                uploadFolder="employees/documents"
                value={form.certificadoLaboralUrl}
                onChange={(url) => setForm((s) => ({ ...s, certificadoLaboralUrl: url }))}
                onClear={() => {
                  setForm((s) => ({ ...s, certificadoLaboralUrl: "" }));
                  removePendingFile("certificadoLaboralUrl");
                }}
                onFileSelect={(file) => handlePendingFileSelect("certificadoLaboralUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                isRequired
                label="Certificado de estudios"
                maxSizeMB={10}
                uploadFolder="employees/documents"
                value={form.certificadoEstudiosUrl}
                onChange={(url) => setForm((s) => ({ ...s, certificadoEstudiosUrl: url }))}
                onClear={() => {
                  setForm((s) => ({ ...s, certificadoEstudiosUrl: "" }));
                  removePendingFile("certificadoEstudiosUrl");
                }}
                onFileSelect={(file) => handlePendingFileSelect("certificadoEstudiosUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                isRequired
                label="Certificado EPS"
                maxSizeMB={10}
                uploadFolder="employees/documents"
                value={form.epsCertificateUrl}
                onChange={(url) => setForm((s) => ({ ...s, epsCertificateUrl: url }))}
                onClear={() => {
                  setForm((s) => ({ ...s, epsCertificateUrl: "" }));
                  removePendingFile("epsCertificateUrl");
                }}
                onFileSelect={(file) => handlePendingFileSelect("epsCertificateUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                isRequired
                label="Certificado de pensión"
                maxSizeMB={10}
                uploadFolder="employees/documents"
                value={form.pensionCertificateUrl}
                onChange={(url) => setForm((s) => ({ ...s, pensionCertificateUrl: url }))}
                onClear={() => {
                  setForm((s) => ({ ...s, pensionCertificateUrl: "" }));
                  removePendingFile("pensionCertificateUrl");
                }}
                onFileSelect={(file) => handlePendingFileSelect("pensionCertificateUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                isRequired
                label="Certificado bancario"
                maxSizeMB={10}
                uploadFolder="employees/documents"
                value={form.bankCertificateUrl}
                onChange={(url) => setForm((s) => ({ ...s, bankCertificateUrl: url }))}
                onClear={() => {
                  setForm((s) => ({ ...s, bankCertificateUrl: "" }));
                  removePendingFile("bankCertificateUrl");
                }}
                onFileSelect={(file) => handlePendingFileSelect("bankCertificateUrl", file)}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-warning bg-warning/10 p-4">
              <p className="text-sm text-warning">
                Selecciona un tipo de identificación para cargar documentos.
              </p>
            </div>
          )}
        </Tab>
        {form.userId.trim() ? (
        <Tab key="beneficiarios" title="Beneficiarios">
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Beneficiarios</h3>
              <button
                type="button"
                className="flex items-center gap-1 text-primary"
                onClick={() => setForm((s) => ({
                  ...s,
                  beneficiaries: [
                    ...s.beneficiaries,
                    { name: "", type: "HIJO", relationship: "", identityDocumentUrl: "", birthCertificateUrl: "" },
                  ],
                }))}
              >
                <BsPlusCircle /> Agregar beneficiario
              </button>
            </div>
            {form.beneficiaries.length === 0 && (
              <p className="text-xs text-default-500">No hay beneficiarios agregados.</p>
            )}
            {form.beneficiaries.map((b, idx) => (
              <div key={idx} className="border rounded p-3 mb-2 relative bg-default-50">
                <button
                  type="button"
                  className="absolute top-2 right-2 text-danger"
                  title="Eliminar beneficiario"
                  onClick={() => removeBeneficiaryAtIndex(idx)}
                >
                  <BsTrash />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    label="Nombre beneficiario"
                    value={b.name}
                    onValueChange={(v) => setForm((s) => {
                      const beneficiaries = [...s.beneficiaries];
                      beneficiaries[idx].name = v;
                      return { ...s, beneficiaries };
                    })}
                  />
                  <Input
                    label="Parentesco"
                    value={b.relationship}
                    onValueChange={(v) => setForm((s) => {
                      const beneficiaries = [...s.beneficiaries];
                      beneficiaries[idx].relationship = v;
                      return { ...s, beneficiaries };
                    })}
                  />
                  <Select
                    label="Tipo de beneficiario"
                    selectedKeys={[b.type]}
                    onSelectionChange={(keys) => {
                      const first = Array.from(keys)[0] as "HIJO" | "CONYUGE" | "PADRE";
                      setForm((s) => {
                        const beneficiaries = [...s.beneficiaries];
                        beneficiaries[idx].type = first;
                        if (first !== "HIJO") {
                          beneficiaries[idx].birthCertificateUrl = "";
                        }
                        return { ...s, beneficiaries };
                      });
                      if (first !== "HIJO") {
                        removePendingBeneficiaryFile(idx, "birthCertificateUrl");
                      }
                    }}
                  >
                    <SelectItem key="HIJO">Hijo</SelectItem>
                    <SelectItem key="CONYUGE">Cónyuge</SelectItem>
                    <SelectItem key="PADRE">Padre</SelectItem>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <FileUpload
                    acceptedFileTypes=".pdf"
                    autoUpload={false}
                    isRequired
                    label="Documento de identidad beneficiario"
                    maxSizeMB={10}
                    uploadFolder="employees/beneficiaries"
                    value={b.identityDocumentUrl}
                    onChange={(url) => setForm((s) => {
                      const beneficiaries = [...s.beneficiaries];
                      beneficiaries[idx].identityDocumentUrl = url;
                      return { ...s, beneficiaries };
                    })}
                    onClear={() => {
                      setForm((s) => {
                        const beneficiaries = [...s.beneficiaries];
                        beneficiaries[idx].identityDocumentUrl = "";
                        return { ...s, beneficiaries };
                      });
                      removePendingBeneficiaryFile(idx, "identityDocumentUrl");
                    }}
                    onFileSelect={(file) =>
                      handlePendingBeneficiaryFileSelect(idx, "identityDocumentUrl", file)
                    }
                  />
                  {/* Si es hijo, pedir registro civil */}
                  {b.type === "HIJO" && (
                    <FileUpload
                      acceptedFileTypes=".pdf"
                      autoUpload={false}
                      isRequired
                      label="Registro civil de nacimiento"
                      maxSizeMB={10}
                      uploadFolder="employees/beneficiaries"
                      value={b.birthCertificateUrl}
                      onChange={(url) => setForm((s) => {
                        const beneficiaries = [...s.beneficiaries];
                        beneficiaries[idx].birthCertificateUrl = url;
                        return { ...s, beneficiaries };
                      })}
                      onClear={() => {
                        setForm((s) => {
                          const beneficiaries = [...s.beneficiaries];
                          beneficiaries[idx].birthCertificateUrl = "";
                          return { ...s, beneficiaries };
                        });
                        removePendingBeneficiaryFile(idx, "birthCertificateUrl");
                      }}
                      onFileSelect={(file) =>
                        handlePendingBeneficiaryFileSelect(idx, "birthCertificateUrl", file)
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Tab>
        ) : null}
        </Tabs>
      )}
      {loadingEmployee || loadingRoles ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Button
          className="w-full mt-6"
          color="primary"
          isDisabled={loading || loadingEmployee || creatingUser || !form.userId.trim()}
          isLoading={loading || loadingEmployee}
          onPress={submit}
        >
          {submitLabel}
        </Button>
      )}
    </div>
  );
}
