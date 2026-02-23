"use client";

import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

export type SupplierSectionsFormState = {
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

type Option = {
  value: string;
  label: string;
};

type CommonProps = {
  form: SupplierSectionsFormState;
  errors: Record<string, string>;
  onStringFieldChange: (field: keyof SupplierSectionsFormState, value: string) => void;
};

type IdentificationProps = CommonProps & {
  identificationTypes: Option[];
  taxRegimes: Option[];
  onIdentificationInputChange: (value: string) => void;
};

export function SupplierIdentificationSection({
  form,
  errors,
  identificationTypes,
  taxRegimes,
  onStringFieldChange,
  onIdentificationInputChange,
}: IdentificationProps) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-3">
      <Select
        errorMessage={errors.identificationType}
        isInvalid={Boolean(errors.identificationType)}
        label="Tipo de Identificación"
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
        label="Dígito Verificación"
        maxLength={1}
        value={form.dv}
        onValueChange={(value) => onStringFieldChange("dv", value)}
      />

      <Input
        label="Sucursal"
        value={form.branch}
        onValueChange={(value) => onStringFieldChange("branch", value)}
      />

      <Select
        errorMessage={errors.taxRegime}
        isInvalid={Boolean(errors.taxRegime)}
        label="Régimen Fiscal"
        selectedKeys={form.taxRegime ? [form.taxRegime] : []}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0];
          onStringFieldChange("taxRegime", String(selected ?? ""));
        }}
      >
        {taxRegimes.map((regime) => (
          <SelectItem key={regime.value}>{regime.label}</SelectItem>
        ))}
      </Select>
    </div>
  );
}

export function SupplierContactSection({
  form,
  errors,
  onStringFieldChange,
}: CommonProps) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
      <Input
        errorMessage={errors.name}
        isInvalid={Boolean(errors.name)}
        label="Nombre"
        value={form.name}
        onValueChange={(value) => onStringFieldChange("name", value)}
      />

      <Input
        errorMessage={errors.contactName}
        isInvalid={Boolean(errors.contactName)}
        label="Nombre de Contacto"
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

export function SupplierLocationSection({
  form,
  errors,
  onStringFieldChange,
}: CommonProps) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
      <Input
        errorMessage={errors.address}
        isInvalid={Boolean(errors.address)}
        label="Dirección"
        value={form.address}
        onValueChange={(value) => onStringFieldChange("address", value)}
      />

      <Input
        label="Código Postal"
        value={form.postalCode}
        onValueChange={(value) => onStringFieldChange("postalCode", value)}
      />

      <Input
        label="País"
        value={form.country}
        onValueChange={(value) => onStringFieldChange("country", value)}
      />

      <Input
        label="Departamento"
        value={form.department}
        onValueChange={(value) => onStringFieldChange("department", value)}
      />

      <Input
        label="Ciudad"
        value={form.city}
        onValueChange={(value) => onStringFieldChange("city", value)}
      />
    </div>
  );
}

export function SupplierPhonesSection({
  form,
  onStringFieldChange,
}: CommonProps) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2">
      <Input
        label="Código Internacional"
        value={form.intlDialCode}
        onValueChange={(value) => onStringFieldChange("intlDialCode", value)}
      />

      <Input
        label="Móvil"
        value={form.mobile}
        onValueChange={(value) => onStringFieldChange("mobile", value)}
      />

      <Input
        label="Móvil Completo"
        value={form.fullMobile}
        onValueChange={(value) => onStringFieldChange("fullMobile", value)}
      />

      <Input
        label="Código Local"
        value={form.localDialCode}
        onValueChange={(value) => onStringFieldChange("localDialCode", value)}
      />

      <Input
        label="Fijo"
        value={form.landline}
        onValueChange={(value) => onStringFieldChange("landline", value)}
      />

      <Input
        label="Extensión"
        value={form.extension}
        onValueChange={(value) => onStringFieldChange("extension", value)}
      />

      <Input
        label="Fijo Completo"
        value={form.fullLandline}
        onValueChange={(value) => onStringFieldChange("fullLandline", value)}
      />
    </div>
  );
}

type SupplierCreditProps = CommonProps & {
  onBooleanFieldChange: (
    field: keyof SupplierSectionsFormState,
    value: boolean,
  ) => void;
};

export function SupplierCreditSection({
  form,
  onStringFieldChange,
  onBooleanFieldChange,
}: SupplierCreditProps) {
  return (
    <div className="space-y-4 pt-3">
      <div className="flex items-center justify-between">
        <Checkbox
          isSelected={form.hasCredit}
          onValueChange={(value) => onBooleanFieldChange("hasCredit", value)}
        >
          Tiene Crédito
        </Checkbox>

        <div className="flex items-center gap-3">
          <span className="text-sm text-default-500">Activo</span>
          <Switch
            isSelected={form.isActive}
            onValueChange={(value) => onBooleanFieldChange("isActive", value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          label="Número Pagaré"
          value={form.promissoryNoteNumber}
          onValueChange={(value) =>
            onStringFieldChange("promissoryNoteNumber", value)
          }
        />

        <Input
          label="Fecha Firma Pagaré"
          type="date"
          value={form.promissoryNoteDate}
          onValueChange={(value) =>
            onStringFieldChange("promissoryNoteDate", value)
          }
        />
      </div>
    </div>
  );
}
