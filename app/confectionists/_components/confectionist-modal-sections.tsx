"use client";

import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

export type ConfectionistSectionsFormState = {
  name: string;
  identificationType: string;
  identification: string;
  dv: string;
  taxRegime: string;
  type: string;
  specialty: string;
  dailyCapacity: string;
  contactName: string;
  email: string;
  intlDialCode: string;
  mobile: string;
  fullMobile: string;
  landline: string;
  extension: string;
  address: string;
  postalCode: string;
  country: string;
  department: string;
  city: string;
  isActive: boolean;
  identityDocumentUrl: string;
  rutDocumentUrl: string;
  commerceChamberDocumentUrl: string;
  passportDocumentUrl: string;
  taxCertificateDocumentUrl: string;
  companyIdDocumentUrl: string;
};

type IdentificationTypeOption = {
  value: string;
  label: string;
};

type SectionsProps = {
  form: ConfectionistSectionsFormState;
  errors: Record<string, string>;
  identificationTypes: IdentificationTypeOption[];
  onStringFieldChange: (field: keyof ConfectionistSectionsFormState, value: string) => void;
  onActiveChange: (value: boolean) => void;
  onIdentificationInputChange: (value: string) => void;
};

export function ConfectionistIdentificationSection({
  form,
  errors,
  identificationTypes,
  onStringFieldChange,
  onIdentificationInputChange,
}: SectionsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
        <Input
          errorMessage={errors.name}
          isInvalid={Boolean(errors.name)}
          label="Nombre"
          value={form.name}
          onValueChange={(value) => onStringFieldChange("name", value)}
        />

        <Select
          errorMessage={errors.identificationType}
          isInvalid={Boolean(errors.identificationType)}
          label="Tipo de identificación"
          selectedKeys={form.identificationType ? [form.identificationType] : []}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            onStringFieldChange("identificationType", String(selected ?? ""));
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
          onValueChange={onIdentificationInputChange}
        />

        <Input
          label="Dígito verificación"
          maxLength={1}
          value={form.dv}
          onValueChange={(value) => onStringFieldChange("dv", value)}
        />

        <Input
          label="Tipo de empaque"
          placeholder="Interno, Satélite, Distribuidora"
          value={form.type}
          onValueChange={(value) => onStringFieldChange("type", value)}
        />

        <Input
          label="Especialidad"
          placeholder="Prenda colgada, Caja master, Etiquetado"
          value={form.specialty}
          onValueChange={(value) => onStringFieldChange("specialty", value)}
        />

        <Input
          label="Capacidad diaria"
          placeholder="Unidades por día"
          type="number"
          value={form.dailyCapacity}
          onValueChange={(value) => onStringFieldChange("dailyCapacity", value)}
        />
    </div>
  );
}

export function ConfectionistContactSection({
  form,
  errors,
  onStringFieldChange,
}: SectionsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
        <Input
          label="Nombre de contacto"
          value={form.contactName}
          onValueChange={(value) => onStringFieldChange("contactName", value)}
        />

        <Input
          errorMessage={errors.email}
          isInvalid={Boolean(errors.email)}
          label="Email"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onValueChange={(value) => onStringFieldChange("email", value)}
        />
    </div>
  );
}

export function ConfectionistPhoneSection({
  form,
  onStringFieldChange,
}: SectionsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
        <Input
          label="Código internacional"
          value={form.intlDialCode}
          onValueChange={(value) => onStringFieldChange("intlDialCode", value)}
        />

        <Input
          label="Móvil"
          value={form.mobile}
          onValueChange={(value) => onStringFieldChange("mobile", value)}
        />

        <Input
          label="Teléfono fijo"
          value={form.landline}
          onValueChange={(value) => onStringFieldChange("landline", value)}
        />
    </div>
  );
}

export function ConfectionistLocationSection({
  form,
  errors,
  onStringFieldChange,
  onActiveChange,
}: SectionsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
        <Input
          errorMessage={errors.address}
          isInvalid={Boolean(errors.address)}
          label="Dirección"
          value={form.address}
          onValueChange={(value) => onStringFieldChange("address", value)}
        />

        <Input
          label="Código postal"
          value={form.postalCode}
          onValueChange={(value) => onStringFieldChange("postalCode", value)}
        />

        <Input
          label="Ciudad"
          value={form.city}
          onValueChange={(value) => onStringFieldChange("city", value)}
        />

        <Input
          label="Departamento"
          value={form.department}
          onValueChange={(value) => onStringFieldChange("department", value)}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm">Activo</span>
        <Switch isSelected={form.isActive} onValueChange={onActiveChange} />
      </div>
    </>
  );
}
