"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import toast from "react-hot-toast";

import { uploadFileToCldinary } from "@/components/file-upload";
import { useSessionStore } from "@/store/session";

type AccountOptionsResponse = {
  user: {
    id: string;
    email: string;
    preferredLanguage: string | null;
  } | null;
  employee: {
    id: string;
    userId: string | null;
    name: string;
    email: string;
    intlDialCode: string | null;
    mobile: string | null;
    fullMobile: string | null;
    landline: string | null;
    extension: string | null;
    address: string | null;
    city: string | null;
    department: string | null;
    employeeImageUrl: string | null;
    signatureImageUrl: string | null;
  } | null;
};

type ProfileForm = {
  name: string;
  email: string;
  intlDialCode: string;
  mobile: string;
  landline: string;
  extension: string;
  address: string;
  city: string;
  department: string;
  employeeImageUrl: string;
  signatureImageUrl: string;
};

function mapResponseToProfile(data: AccountOptionsResponse): ProfileForm {
  return {
    name: data.employee?.name ?? "",
    email: data.user?.email ?? data.employee?.email ?? "",
    intlDialCode: data.employee?.intlDialCode ?? "57",
    mobile: data.employee?.mobile ?? "",
    landline: data.employee?.landline ?? "",
    extension: data.employee?.extension ?? "",
    address: data.employee?.address ?? "",
    city: data.employee?.city ?? "",
    department: data.employee?.department ?? "",
    employeeImageUrl: data.employee?.employeeImageUrl ?? "",
    signatureImageUrl: data.employee?.signatureImageUrl ?? "",
  };
}

export function OptionsPageClient() {
  const sessionUser = useSessionStore((s) => s.user);
  const setSession = useSessionStore((s) => s.setSession);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingEmployeeImage, setUploadingEmployeeImage] = useState(false);
  const [uploadingSignatureImage, setUploadingSignatureImage] = useState(false);
  const [language, setLanguage] = useState("es");

  const employeeImageInputRef = useRef<HTMLInputElement>(null);
  const signatureImageInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    email: "",
    intlDialCode: "57",
    mobile: "",
    landline: "",
    extension: "",
    address: "",
    city: "",
    department: "",
    employeeImageUrl: "",
    signatureImageUrl: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    let active = true;

    fetch("/api/account/options", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as AccountOptionsResponse;
      })
      .then((data) => {
        if (!active) return;

        setLanguage(String(data.user?.preferredLanguage ?? "es"));
        setProfile(mapResponseToProfile(data));

        const currentSessionUser = useSessionStore.getState().user;

        if (currentSessionUser) {
          setSession({
            ...currentSessionUser,
            name: data.employee?.name ?? currentSessionUser.name,
            avatarUrl:
              data.employee?.employeeImageUrl ??
              currentSessionUser.avatarUrl ??
              null,
          });
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Error cargando opciones");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setSession]);

  const uploadImage = async (file: File, type: "employee" | "signature") => {
    const isEmployee = type === "employee";
    const setUploading = isEmployee
      ? setUploadingEmployeeImage
      : setUploadingSignatureImage;
    const folder = isEmployee ? "employees/profile" : "employees/signatures";
    const publicId = `${type}-${sessionUser?.id ?? "employee"}-${Date.now()}`;

    try {
      setUploading(true);
      const url = await uploadFileToCldinary(file, folder, publicId);

      setProfile((prev) => ({
        ...prev,
        employeeImageUrl: isEmployee ? url : prev.employeeImageUrl,
        signatureImageUrl: isEmployee ? prev.signatureImageUrl : url,
      }));

      if (isEmployee && sessionUser) {
        setSession({
          ...sessionUser,
          avatarUrl: url,
        });
      }

      toast.success("Imagen subida correctamente");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo subir la imagen",
      );
    } finally {
      setUploading(false);
      if (isEmployee && employeeImageInputRef.current) {
        employeeImageInputRef.current.value = "";
      }
      if (!isEmployee && signatureImageInputRef.current) {
        signatureImageInputRef.current.value = "";
      }
    }
  };

  const onEmployeeImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida");
      return;
    }

    await uploadImage(file, "employee");
  };

  const onSignatureImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida");
      return;
    }

    await uploadImage(file, "signature");
  };

  const clearImage = (type: "employee" | "signature") => {
    const isEmployee = type === "employee";

    setProfile((prev) => ({
      ...prev,
      employeeImageUrl: isEmployee ? "" : prev.employeeImageUrl,
      signatureImageUrl: isEmployee ? prev.signatureImageUrl : "",
    }));

    if (isEmployee && sessionUser) {
      setSession({
        ...sessionUser,
        avatarUrl: null,
      });
    }
  };

  const saveProfile = async () => {
    if (savingProfile) return;

    try {
      setSavingProfile(true);
      const res = await fetch("/api/account/options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AccountOptionsResponse;

      setProfile(mapResponseToProfile(data));

      if (sessionUser) {
        setSession({
          ...sessionUser,
          name: data.employee?.name ?? sessionUser.name,
          avatarUrl: data.employee?.employeeImageUrl ?? null,
        });
      }

      toast.success("Información actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveLanguage = async () => {
    if (savingLanguage) return;

    try {
      setSavingLanguage(true);
      const res = await fetch("/api/account/options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preferredLanguage: language }),
      });

      if (!res.ok) throw new Error(await res.text());
      toast.success("Idioma actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar idioma");
    } finally {
      setSavingLanguage(false);
    }
  };

  const changePassword = async () => {
    if (savingPassword) return;

    try {
      setSavingPassword(true);
      const res = await fetch("/api/account/options/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(passwordForm),
      });

      if (!res.ok) throw new Error(await res.text());

      setPasswordForm({ currentPassword: "", newPassword: "" });
      toast.success("Contraseña actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar contraseña");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-default-500">Cargando opciones...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Opciones de cuenta</h1>

      <section className="space-y-4 rounded-large border border-default-200 p-4">
        <h2 className="text-lg font-medium">Editar información</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Nombre"
            value={profile.name}
            onValueChange={(v) => setProfile((s) => ({ ...s, name: v }))}
          />
          <Input
            label="Correo"
            value={profile.email}
            onValueChange={(v) => setProfile((s) => ({ ...s, email: v }))}
          />
          <Input
            label="Código internacional"
            value={profile.intlDialCode}
            onValueChange={(v) => setProfile((s) => ({ ...s, intlDialCode: v }))}
          />
          <Input
            label="Móvil"
            value={profile.mobile}
            onValueChange={(v) => setProfile((s) => ({ ...s, mobile: v }))}
          />
          <Input
            label="Fijo"
            value={profile.landline}
            onValueChange={(v) => setProfile((s) => ({ ...s, landline: v }))}
          />
          <Input
            label="Extensión"
            value={profile.extension}
            onValueChange={(v) => setProfile((s) => ({ ...s, extension: v }))}
          />
          <Input
            label="Dirección"
            value={profile.address}
            onValueChange={(v) => setProfile((s) => ({ ...s, address: v }))}
          />
          <Input
            label="Ciudad"
            value={profile.city}
            onValueChange={(v) => setProfile((s) => ({ ...s, city: v }))}
          />
          <Input
            label="Departamento"
            value={profile.department}
            onValueChange={(v) => setProfile((s) => ({ ...s, department: v }))}
          />

          <div className="space-y-3 rounded-large border border-default-200 p-3">
            <div className="text-sm font-medium">Imagen de empleado</div>
            <div className="flex items-center gap-3">
              <Avatar
                name={profile.name || "Empleado"}
                size="lg"
                src={profile.employeeImageUrl || undefined}
              />
              <div className="flex gap-2">
                <input
                  ref={employeeImageInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  type="file"
                  onChange={onEmployeeImageSelected}
                />
                <Button
                  isLoading={uploadingEmployeeImage}
                  variant="flat"
                  onPress={() => employeeImageInputRef.current?.click()}
                >
                  Subir imagen
                </Button>
                <Button
                  color="danger"
                  isDisabled={!profile.employeeImageUrl}
                  variant="light"
                  onPress={() => clearImage("employee")}
                >
                  Quitar
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-large border border-default-200 p-3">
            <div className="text-sm font-medium">Firma del empleado</div>
            <div className="rounded-medium border border-default-200 bg-default-50 p-3">
              {profile.signatureImageUrl ? (
                <img
                  alt="Firma"
                  className="h-24 w-full object-contain"
                  src={profile.signatureImageUrl}
                />
              ) : (
                <div className="h-24 content-center text-center text-sm text-default-500">
                  Sin firma cargada
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={signatureImageInputRef}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                type="file"
                onChange={onSignatureImageSelected}
              />
              <Button
                isLoading={uploadingSignatureImage}
                variant="flat"
                onPress={() => signatureImageInputRef.current?.click()}
              >
                Subir firma
              </Button>
              <Button
                color="danger"
                isDisabled={!profile.signatureImageUrl}
                variant="light"
                onPress={() => clearImage("signature")}
              >
                Quitar
              </Button>
            </div>
          </div>
        </div>

        <Button color="primary" isLoading={savingProfile} onPress={saveProfile}>
          Guardar información
        </Button>
      </section>

      <section className="space-y-4 rounded-large border border-default-200 p-4">
        <h2 className="text-lg font-medium">Idioma y preferencias</h2>
        <div className="max-w-sm">
          <Select
            label="Idioma"
            selectedKeys={[language]}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setLanguage(String(first ?? "es"));
            }}
          >
            <SelectItem key="es">Español</SelectItem>
            <SelectItem key="en">English</SelectItem>
            <SelectItem key="pt">Português</SelectItem>
          </Select>
        </div>
        <Button color="primary" isLoading={savingLanguage} onPress={saveLanguage}>
          Guardar idioma
        </Button>
      </section>

      <section className="space-y-4 rounded-large border border-default-200 p-4">
        <h2 className="text-lg font-medium">Cambiar contraseña</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Contraseña actual"
            type="password"
            value={passwordForm.currentPassword}
            onValueChange={(v) =>
              setPasswordForm((s) => ({ ...s, currentPassword: v }))
            }
          />
          <Input
            label="Nueva contraseña"
            type="password"
            value={passwordForm.newPassword}
            onValueChange={(v) => setPasswordForm((s) => ({ ...s, newPassword: v }))}
          />
        </div>
        <Button color="primary" isLoading={savingPassword} onPress={changePassword}>
          Actualizar contraseña
        </Button>
      </section>
    </div>
  );
}
